import { useNavigate } from "react-router";

/**
 * Returns a function going one step back in the browser history, which keeps the scroll
 * position and history of that page; started on this page, it opens `fallback` instead.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
