export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
      <div className="shadow-md">
        {children}
      </div>
  )
} 