import AdminNavBar from "@/components/admin/AdminNavBar";
import AmplifyProvider from "@/app/organiser/AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <AdminNavBar />
        {children}
      </AuthProvider>
    </AmplifyProvider>
  );
}
