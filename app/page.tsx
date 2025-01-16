import Link from 'next/link'
import { MessageSquare, Users, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-gray-50 p-8">
      <div className="max-w-3xl w-full text-center mb-12">
        {/* Logo and Title */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20 mb-6">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Welcome to Slacker
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Your team's communication hub for seamless collaboration
        </p>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 text-blue-600 mb-4">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Real-time Chat</h3>
            <p className="text-gray-600">Instant messaging with your team members in channels or direct messages</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 text-green-600 mb-4">
              <Users size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Team Channels</h3>
            <p className="text-gray-600">Organize conversations by topics, projects, or teams</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 text-purple-600 mb-4">
              <Zap size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI Responses</h3>
            <p className="text-gray-600">Smart auto-responses when you're away or busy</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Sign In
          </Link>
          <Link 
            href="/signup" 
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors duration-200"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}
