import { Component } from "react";
import { useLocation } from "react-router-dom";
import ErrorPage from "./ErrorPage";

class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Page error:", error, info.componentStack);
  }

  // Leaving the broken page clears the error
  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.pathname !== this.props.pathname) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? <ErrorPage code={500} /> : this.props.children;
  }
}

// Shows the 500 page when a page crashes while rendering; the navbar and footer
// sit outside it, so they stay usable
export default function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary pathname={pathname}>{children}</ErrorBoundary>;
}
