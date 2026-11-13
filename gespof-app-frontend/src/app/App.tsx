import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Toaster } from "@/shared/components/ui/sonner";
import { AuthProvider } from "@/shared/hooks/AuthContext";
import { PhotoProfilProvider } from "@/shared/hooks/PhotoProfilContext";
import { AppRoutes } from "@/app/router";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <PhotoProfilProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </PhotoProfilProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
