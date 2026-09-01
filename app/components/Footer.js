import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer mt-auto" style={{ borderTop: "1px solid #1a253c", background: "#080743" }}>
      <div className="container py-4">
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 text-center">
          <p className="mb-0 text-white-50" style={{ fontSize: "14px" }}>
            © 2026, <strong>Eventuna</strong>. All rights reserved.
          </p>
          <nav className="d-flex flex-wrap justify-content-center gap-4" aria-label="Legal links">
            <Link href="https://eventuna.com/about" style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textDecoration: "none" }}>About Us</Link>
            <Link href="https://eventuna.com/privacy" style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textDecoration: "none" }}>Privacy Policy</Link>
            <Link href="https://eventuna.com/terms" style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textDecoration: "none" }}>Terms &amp; Conditions</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

