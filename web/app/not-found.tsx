export default function NotFound() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[40vh]">
      <h1 className="text-4xl font-bold text-red-600 mb-2">404</h1>
      <p className="text-gray-600 mb-6">Page not found</p>
      <a
        href="/"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Return to dashboard
      </a>
    </div>
  );
}
