import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Card3D from "@/components/Card3D";
import { fetchOfficialCertificate } from "@/lib/certificate";
import { loadPublicCardByUsername } from "@/lib/admin-firestore";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

async function getVerifiedCard(usernameInput: string) {
  const username = usernameInput.replace(/^@/, "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(username)) return null;
  const card = await loadPublicCardByUsername(username).catch(() => null);
  if (!card || card.username.toLowerCase() !== username) return null;
  const certificate = await fetchOfficialCertificate(username).catch(() => null);
  if (!certificate || certificate.name.toLocaleLowerCase("id-ID") !== card.name.toLocaleLowerCase("id-ID")) return null;
  return { ...card, name: certificate.name, username: certificate.username };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const card = await getVerifiedCard(username);
  if (!card) return { title: "Kartu member tidak ditemukan | IMPHNEN" };
  return {
    title: `${card.name} (@${card.username}) | Kartu member IMPHNEN`,
    description: `Preview kartu member resmi IMPHNEN untuk ${card.name} (@${card.username}).`,
  };
}

export default async function UsernameCardPage({ params }: Props) {
  const { username } = await params;
  const card = await getVerifiedCard(username);
  if (!card) notFound();

  return (
    <main className="public-card-page">
      <header className="public-card-heading">
        <p className="public-card-kicker">Kartu member IMPHNEN</p>
        <h1>{card.name}</h1>
        <p>@{card.username}</p>
      </header>
      <Card3D card={card} spinning={true} snap={null} />
      <p className="public-card-note">Kartu ini cocok dengan sertifikat member resmi IMPHNEN.</p>
      <Link className="btn btn-ghost" href="/">Buat kartu sendiri</Link>
    </main>
  );
}
