import Script from "next/script";
import Preloader from "./components/Preloader";
import AuthProvider from "./components/AuthProvider";
import "./globals.css";

export const metadata = {
  title: "Eventuna",
  description: "Eventuna event user site",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-100">
      <head>
        <link rel="icon" type="image/png" href="/images/fav.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap"
          rel="stylesheet"
        />
        <link href="/vendor/unicons-2.0.1/css/unicons.css" rel="stylesheet" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />
        <link href="/css/style.css" rel="stylesheet" />
        <link href="/css/responsive.css" rel="stylesheet" />
        <link href="/css/night-mode.css" rel="stylesheet" />
        <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" />
        <link href="/vendor/OwlCarousel/assets/owl.carousel.css" rel="stylesheet" />
        <link href="/vendor/OwlCarousel/assets/owl.theme.default.min.css" rel="stylesheet" />
        <link href="/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" />
        <link href="/vendor/bootstrap-select/dist/css/bootstrap-select.min.css" rel="stylesheet" />
        <link href="/css/vertical-responsive-menu.min.css" rel="stylesheet" />
        <link href="/css/jquery-steps.css" rel="stylesheet" />
        <link href="/css/datepicker.min.css" rel="stylesheet" />
      </head>
      <body className="d-flex flex-column h-100">
        <Preloader />
        <AuthProvider>
          {children}
        </AuthProvider>
        <Script src="/js/jquery.min.js" strategy="afterInteractive" />
        <Script src="/vendor/bootstrap/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
        <Script src="/vendor/OwlCarousel/owl.carousel.js" strategy="afterInteractive" />
        <Script src="/vendor/bootstrap-select/dist/js/bootstrap-select.min.js" strategy="afterInteractive" />
        <Script src="/vendor/mixitup/dist/mixitup.min.js" strategy="afterInteractive" />
        <Script src="/js/datepicker.min.js" strategy="afterInteractive" />
        <Script src="/js/i18n/datepicker.en.js" strategy="afterInteractive" />
        <Script src="/js/jquery-steps.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
