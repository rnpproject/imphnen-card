"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  getAddress,
  http,
  isAddress,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { renderCanvas } from "@/lib/exportPng";
import { type CardState } from "@/lib/card";
import { MEMBER_CARD_NFT_ABI } from "@/lib/nftAbi";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

type Status = { text: string; kind: "ok" | "err" | "busy" | "" };
type Props = {
  card: CardState;
  cardSaved: boolean;
  ownerVerified: boolean;
  metadata: string;
  onCopy: () => void;
  copyStatus: Status;
};

const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_NFT_CHAIN_ID || "56");
const TARGET_CHAIN = TARGET_CHAIN_ID === 97 ? bscTestnet : bsc;
const RPC_URL = TARGET_CHAIN_ID === 97
  ? "https://bsc-testnet-dataseed.bnbchain.org"
  : "https://bsc-dataseed.bnbchain.org";
const CONTRACT_ADDRESS_RAW = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "";
const CONTRACT_ADDRESS = isAddress(CONTRACT_ADDRESS_RAW) ? getAddress(CONTRACT_ADDRESS_RAW) : null;

const publicClient = createPublicClient({ chain: TARGET_CHAIN, transport: http(RPC_URL) });

function errorCode(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "number" ? code : null;
  }
  return null;
}

function errorText(error: unknown) {
  if (errorCode(error) === 4001) return "Permintaan ditolak di wallet.";
  if (error instanceof Error) return error.message;
  return "Transaksi gagal. Coba lagi.";
}

async function switchToTargetChain(provider: EIP1193Provider) {
  const chainHex = `0x${TARGET_CHAIN_ID.toString(16)}`;
  const current = await provider.request({ method: "eth_chainId" });
  if (String(current).toLowerCase() === chainHex.toLowerCase()) return;

  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
  } catch (error) {
    if (errorCode(error) !== 4902) throw error;
    const isTestnet = TARGET_CHAIN_ID === 97;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: chainHex,
        chainName: isTestnet ? "BNB Smart Chain Testnet" : "BNB Smart Chain",
        nativeCurrency: { name: isTestnet ? "tBNB" : "BNB", symbol: isTestnet ? "tBNB" : "BNB", decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [isTestnet ? "https://testnet.bscscan.com" : "https://bscscan.com"],
      }],
    });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
  }
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG kartu gagal dibuat.")), "image/png");
  });
}

export default function NftMintPanel({ card, cardSaved, ownerVerified, metadata, onCopy, copyStatus }: Props) {
  const [account, setAccount] = useState<Address | null>(null);
  const [busy, setBusy] = useState<"connect" | "mint" | null>(null);
  const [status, setStatus] = useState<Status>({ text: "", kind: "" });
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [tokenUri, setTokenUri] = useState("");
  const isConfigured = CONTRACT_ADDRESS !== null;
  const chainName = TARGET_CHAIN_ID === 97 ? "BSC Testnet" : "BSC Mainnet";
  const shortenedAccount = useMemo(() => account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "", [account]);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const refreshAccount = (accounts: unknown) => {
      const first = Array.isArray(accounts) ? accounts[0] : null;
      setAccount(typeof first === "string" && isAddress(first) ? getAddress(first) : null);
    };
    void provider.request({ method: "eth_accounts" }).then(refreshAccount).catch(() => undefined);
    provider.on?.("accountsChanged", refreshAccount);
    return () => { provider.removeListener?.("accountsChanged", refreshAccount); };
  }, []);

  async function connectWallet() {
    const provider = window.ethereum;
    if (!provider) {
      setStatus({ text: "Wallet EVM tidak ditemukan. Buka situs dari browser MetaMask atau Binance Wallet.", kind: "err" });
      return null;
    }
    setBusy("connect");
    setStatus({ text: "Menghubungkan wallet dan memilih jaringan...", kind: "busy" });
    try {
      await switchToTargetChain(provider);
      const wallet = createWalletClient({ chain: TARGET_CHAIN, transport: custom(provider) });
      const [address] = await wallet.requestAddresses();
      if (!address) throw new Error("Wallet tidak memberikan alamat akun.");
      setAccount(address);
      setStatus({ text: `Wallet terhubung di ${chainName}.`, kind: "ok" });
      return address;
    } catch (error) {
      setStatus({ text: errorText(error), kind: "err" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function onMint() {
    if (!ownerVerified) {
      setStatus({ text: "Login dengan Facebook yang UID-nya cocok dengan kartu untuk mint NFT.", kind: "err" });
      return;
    }
    if (!CONTRACT_ADDRESS) {
      setStatus({ text: "Alamat kontrak belum dikonfigurasi. Deploy kontrak, lalu isi NEXT_PUBLIC_NFT_CONTRACT_ADDRESS.", kind: "err" });
      return;
    }
    const problem = !/^\d{5,20}$/.test(card.uid)
      ? "Cari data member terlebih dahulu."
      : !card.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(card.joined)
        ? "Data nama atau tanggal bergabung belum lengkap."
        : null;
    if (problem) { setStatus({ text: problem, kind: "err" }); return; }

    const provider = window.ethereum;
    if (!provider) {
      setStatus({ text: "Wallet EVM tidak ditemukan. Buka situs dari browser wallet.", kind: "err" });
      return;
    }

    setBusy("mint");
    setTxHash(null);
    setTokenUri("");
    try {
      await switchToTargetChain(provider);
      const walletClient = createWalletClient({ chain: TARGET_CHAIN, transport: custom(provider) });
      const [connectedAddress] = await walletClient.requestAddresses();
      if (!connectedAddress) throw new Error("Hubungkan wallet untuk melanjutkan.");
      const minter = getAddress(connectedAddress);
      setAccount(minter);

      setStatus({ text: "Membuat gambar depan dan belakang NFT...", kind: "busy" });
      const nftCard = { ...card, showUid: false };
      const [frontCanvas, backCanvas] = await Promise.all([
        renderCanvas(nftCard, "front", 1320),
        renderCanvas(nftCard, "back", 1320),
      ]);
      const [frontBlob, backBlob] = await Promise.all([canvasPng(frontCanvas), canvasPng(backCanvas)]);
      const form = new FormData();
      form.append("card", JSON.stringify(nftCard));
      form.append("front", new File([frontBlob], "member-card-front.png", { type: "image/png" }));
      form.append("back", new File([backBlob], "member-card-back.png", { type: "image/png" }));

      setStatus({ text: "Menyimpan gambar 3D dan metadata ke IPFS...", kind: "busy" });
      const upload = await fetch("/api/nft/metadata", { method: "POST", body: form });
      const uploadResult = await upload.json().catch(() => null);
      if (!upload.ok || typeof uploadResult?.tokenURI !== "string") {
        throw new Error(uploadResult?.error ?? `Upload metadata gagal (${upload.status}).`);
      }
      const uri: string = uploadResult.tokenURI;
      setTokenUri(uri);

      setStatus({ text: "Menghitung estimasi gas mint...", kind: "busy" });
      const gas = await publicClient.estimateContractGas({
        address: CONTRACT_ADDRESS,
        abi: MEMBER_CARD_NFT_ABI,
        functionName: "mint",
        args: [uri],
        account: minter,
      });
      const gasPrice = await publicClient.getGasPrice();
      const estimate = formatEther(gas * gasPrice);
      setStatus({ text: `Estimasi sekitar ${estimate} BNB untuk gas. Konfirmasi mint di wallet.`, kind: "busy" });

      const hash = await walletClient.writeContract({
        account: minter,
        address: CONTRACT_ADDRESS,
        abi: MEMBER_CARD_NFT_ABI,
        functionName: "mint",
        args: [uri],
        gas,
      });
      setTxHash(hash);
      setStatus({ text: "Transaksi dikirim. Menunggu konfirmasi jaringan...", kind: "busy" });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaksi mint gagal di jaringan.");
      setStatus({ text: "NFT berhasil di-mint dan dikirim ke wallet.", kind: "ok" });
    } catch (error) {
      setStatus({ text: errorText(error), kind: "err" });
    } finally {
      setBusy(null);
    }
  }

  const explorer = TARGET_CHAIN_ID === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com";

  return (
    <section className="panel p-nft" aria-labelledby="h-nft">
      <h2 id="h-nft">NFT kartu 3D <span className="tag">{chainName}</span></h2>
      <p className="hint">Mint gratis: tidak ada harga NFT. Wallet membayar gas BNB. Gambar depan, belakang, dan model 3D disimpan di IPFS. UID Facebook tidak disertakan dalam NFT.</p>
      {!isConfigured ? (
        <p className="mode">Kontrak belum di-deploy. Setelah deploy, isi <code>NEXT_PUBLIC_NFT_CONTRACT_ADDRESS</code> dan set <code>PINATA_JWT</code> di server.</p>
      ) : (
        <>
          <div className="tools">
            <button className="btn btn-ghost" type="button" onClick={connectWallet} disabled={busy !== null}>
              {busy === "connect" ? "Menghubungkan..." : account ? shortenedAccount : "Hubungkan wallet"}
            </button>
            <button className="btn btn-primary" type="button" onClick={onMint} disabled={busy !== null || !account || !cardSaved || !ownerVerified}>
              {busy === "mint" ? "Menyiapkan mint..." : "Mint NFT gratis"}
            </button>
          </div>
          {!account ? <p className="hint">Hubungkan MetaMask atau Binance Wallet. Wallet akan diminta berpindah ke {chainName}.</p> : null}
          {!cardSaved ? <p className="hint">Simpan kartu terlebih dahulu sebelum mint NFT.</p> : null}
          {!ownerVerified ? <p className="hint">Login dengan Facebook yang UID-nya cocok dengan kartu untuk mint.</p> : null}
        </>
      )}
      <p className={`status ${status.kind}`} role="status" aria-live="polite">{status.text}</p>
      {txHash ? <p className="hint">Transaksi: <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">Lihat di BscScan</a></p> : null}
      {tokenUri ? <p className="hint">Metadata IPFS: <code>{tokenUri}</code></p> : null}
      <details>
        <summary>Pratinjau metadata</summary>
        <textarea readOnly aria-label="Metadata NFT dalam JSON" spellCheck={false} value={metadata} />
        <button className="btn btn-ghost" type="button" onClick={onCopy}>Salin metadata</button>
        <p className={`status ${copyStatus.kind}`} role="status" aria-live="polite">{copyStatus.text}</p>
      </details>
    </section>
  );
}
