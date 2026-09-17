import "./App.css";
import { StrictMode } from "react";
import { NavLink } from "react-router";
import { Outlet } from "react-router";

function Header() {
  const headers = [
    { name: "Kalender", link: "calendar" },
    { name: "Letzter", link: "last" },
  ];
  const headersNav = headers.map((header) => (
    <li key={header.link}>
      <NavLink
        className="text-gray-500 transition hover:text-gray-500/75"
        to={"/" + header.link}
      >
        {header.name}
      </NavLink>
    </li>
  ));

  return (
    <StrictMode>
      <header id="title-bar" className="bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          <NavLink className="block text-teal-600" to="/">
            <span className="sr-only">Home</span>
            <svg
              className="w-8 h-8"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5"
              />
            </svg>
          </NavLink>

          <div className="flex flex-1 items-center justify-end md:justify-between">
            <nav aria-label="Global" className="hidden md:block">
              <ul className="flex items-center gap-6 text-sm">{headersNav}</ul>
            </nav>

            <div className="flex items-center gap-4">
              <button className="block rounded-sm bg-gray-100 p-2.5 text-gray-600 transition hover:text-gray-600/75 md:hidden">
                <span className="sr-only">Toggle menu</span>
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      <div style={{ marginTop: "100px" }}>
        <Outlet />
      </div>
    </StrictMode>
  );
}

function App() {
  return (
    <>
      <div className="app-container">
        <Outlet />
      </div>
    </>
  );
}

export default App;
