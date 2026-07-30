import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer mt-auto">
      <div className="footer-top">
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-md-6">
              <div className="footer-content">
                <h4>Company</h4>
                <ul className="footer-link-list">
                  <li>
                    <Link href="https://eventuna.com/about" className="footer-link">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="footer-link">
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="footer-link">
                      FAQ
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="footer-link">
                      Contact Us
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="footer-content">
                <h4>Useful Links</h4>
                <ul className="footer-link-list">
                  <li>
                    <Link href="/create-event" className="footer-link">
                      Create Event
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="footer-link">
                      Sell Tickets Online
                    </Link>
                  </li>
                  <li>
                    <Link href="https://eventuna.com/privacy" className="footer-link">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="https://eventuna.com/terms" className="footer-link">
                      Terms & Conditions
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="footer-content">
                <h4>Resources</h4>
                <ul className="footer-link-list">
                  <li>
                    <Link href="#" className="footer-link">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="footer-link">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="footer-link">
                      Refer a Friend
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="footer-content">
                <h4>Follow Us</h4>
                <ul className="social-links">
                  <li>
                    <a href="#" className="social-link">
                      <i className="fab fa-facebook-square"></i>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="social-link">
                      <i className="fab fa-instagram"></i>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="social-link">
                      <i className="fab fa-twitter"></i>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="social-link">
                      <i className="fab fa-linkedin-in"></i>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="social-link">
                      <i className="fab fa-youtube"></i>
                    </a>
                  </li>
                </ul>
              </div>
              <div className="footer-content">
                <h4>Download Mobile App</h4>
                <div className="download-app-link">
                  <a href="#" className="download-btn">
                    <img src="/images/app-store.png" alt="App Store" />
                  </a>
                  <a href="#" className="download-btn">
                    <img src="/images/google-play.png" alt="Google Play" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="footer-copyright-text">
                <p className="mb-0">
                  © 2026, <strong>Eventuna</strong>. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
