import Link from "next/link";

export const metadata = {
  title: "Kebijakan Privasi | Kartu Member IMPHNEN",
  description: "Informasi data yang digunakan oleh Kartu Member IMPHNEN dan cara mengelolanya.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-wrap">
      <article className="panel legal-panel">
        <p className="legal-kicker">Kartu Member IMPHNEN</p>
        <h1>Kebijakan Privasi</h1>
        <p className="hint">Terakhir diperbarui: 12 November 2026</p>

        <h2>Data yang kami simpan</h2>
        <p>Aplikasi ini menggunakan UID Facebook yang Anda masukkan untuk mencari profil di database. Jika belum tersedia, server dapat mengambil nama, label peran (misalnya Member atau Admin), dan tanggal bergabung dari halaman grup Facebook yang dapat diakses oleh sesi scraper.</p>
        <p>Jika Anda menyimpan kartu, Firestore menyimpan UID, nama, username, kota, provinsi, label peran, tanggal bergabung, pilihan warna, dan pengaturan tampilan UID. Firestore juga menyimpan klaim username agar tidak digunakan oleh kartu lain.</p>

        <h2>Penggunaan data</h2>
        <p>Data digunakan untuk mencari dan menampilkan kartu, mencegah username ganda, serta membuat metadata NFT saat Anda memilih fitur mint. Data profil dan kartu disimpan di Firestore. Cookie scraper disimpan sebagai konfigurasi server dan tidak dikirim ke browser.</p>
        <p>Mint NFT membuat nama, username, kota, provinsi, tanggal bergabung, dan atribut kartu tersedia secara publik di blockchain BNB Smart Chain dan metadata IPFS. Data blockchain bersifat permanen dan tidak dapat kami hapus setelah mint.</p>

        <h2>Penyimpanan dan penghapusan</h2>
        <p>Data disimpan selama diperlukan untuk menyediakan layanan. Anda dapat menghapus data aplikasi secara langsung setelah login dan verifikasi Facebook melalui <Link href="/data-deletion">halaman penghapusan data</Link>. Penghapusan mencakup profil hasil scraping, kartu, dan klaim username terkait; data pada blockchain publik tidak dapat diubah atau dihapus.</p>

        <h2>Layanan pihak ketiga</h2>
        <p>Aplikasi menggunakan Firebase Firestore untuk database, Facebook untuk sumber halaman profil grup, dan Pinata/IPFS untuk berkas NFT jika fitur mint digunakan. Penggunaan layanan tersebut tunduk pada kebijakan masing-masing penyedia.</p>

        <h2>Kontak</h2>
        <p>Untuk pertanyaan privasi atau bantuan menghapus data, kunjungi <Link href="/data-deletion">halaman penghapusan data</Link>.</p>
        <p><Link href="/">Kembali ke aplikasi</Link></p>
      </article>
    </main>
  );
}
