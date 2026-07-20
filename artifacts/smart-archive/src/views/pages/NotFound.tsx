import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <span className="text-8xl mb-6">🗂️</span>
      <h1 className="text-4xl font-bold text-foreground mb-3">404</h1>
      <p className="text-xl font-semibold text-foreground mb-2">الصفحة غير موجودة</p>
      <p className="text-muted-foreground mb-8 max-w-xs">
        الصفحة التي تبحث عنها غير موجودة أو تم نقلها
      </p>
      <Link
        to="/"
        className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
