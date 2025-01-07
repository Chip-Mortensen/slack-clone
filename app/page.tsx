import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">
        Welcome to Slack Clone
      </h1>
      <div className="flex gap-4 flex-col sm:flex-row">
        <Link 
          href="/login" 
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded text-center"
        >
          Login
        </Link>
        <Link 
          href="/signup" 
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-6 rounded text-center"
        >
          Sign Up
        </Link>
      </div>
    </div>
  )
}
