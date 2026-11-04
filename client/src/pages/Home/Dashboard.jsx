import { useCurrentUser } from "../Layout/currentUserContext";
import PortfolioOverview from "./PortfolioOverview";

export default function Dashboard() {
  const user = useCurrentUser();

  return (
    <div className="container-fluid">
      <PortfolioOverview username={user?.username} />
    </div>
  );
}
