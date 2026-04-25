import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-4">
          Your Google account is not authorized to access the admin panel.
        </p>
        <Link href="/api/auth/signin" className="text-blue-500 hover:text-blue-700 font-bold text-sm">
          Try a different account
        </Link>
      </div>
    </div>
  );
}
