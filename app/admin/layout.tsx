import AdminNavBar from "@/components/admin/AdminNavBar";
import PortalFooter from "@/components/PortalFooter";
import AmplifyProvider from "@/app/organiser/AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-dark-darker">
          <AdminNavBar />
          <div className="flex-1">{children}</div>
          <PortalFooter />
        </div>
      </AuthProvider>
    </AmplifyProvider>
  );
}
