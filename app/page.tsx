import Image from "next/image";
import MemberCardApp from "@/components/MemberCardApp";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <header className="top">
        <div className="wrap">
          <Image className="badge" src="/badge.png" alt="IMPHNEN Member Card" width={112} height={112} priority />
          <div>
            <h1>Pembuat kartu member</h1>
            <p className="lede">Cari dengan UID, cocokkan identitas sertifikat IMPHNEN, lalu simpan dan bagikan preview kartu.</p>
          </div>
        </div>
      </header>
      <MemberCardApp />
    </>
  );
}
