import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  navigate("/", { replace: true });
  return null;
};

export default Index;
