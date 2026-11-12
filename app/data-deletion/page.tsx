import Link from "next/link";
import DeleteMyData from "@/components/DeleteMyData";

export const metadata = {
  title: "Penghapusan Data | Kartu Member IMPHNEN",
  description: "Verifikasi dengan Facebook untuk menghapus data UID dan kartu member Anda.",
};

export default function DataDeletionPage() {
  return (
    <main className="legal-wrap">
      <article className="panel legal-panel">
        <p className="legal-kicker">Kartu Member IMPHNEN</p>
        <h1>Penghapusan Data</h1>
        <p className="hint">Login ke akun Facebook yang UID-nya digunakan untuk membuat kartu. Setelah verifikasi, data aplikasi untuk UID akun tersebut langsung dihapus.</p>
        <ol>
          <li>Login dan verifikasi melalui Facebook.</li>
          <li>Konfirmasi penghapusan untuk menghapus profil hasil scraping, kartu member, dan klaim username terkait.</li>
          <li>Data NFT yang sudah tercatat di blockchain publik dan berkas IPFS tidak dapat dihapus atau diubah.</li>
        </ol>
        <DeleteMyData />
        <p className="legal-foot"><Link href="/privacy">Kebijakan Privasi</Link> · <Link href="/">Kembali ke aplikasi</Link></p>
      </article>
    </main>
  );
}
