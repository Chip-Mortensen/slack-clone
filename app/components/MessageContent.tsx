import { Paperclip } from 'lucide-react'

interface MessageContentProps {
  content: string
  fileUrl?: string | null
  fileName?: string | null
}

export default function MessageContent({ content, fileUrl, fileName }: MessageContentProps) {
  return (
    <div className="mt-1 text-gray-900">
      <p className="whitespace-pre-wrap break-words">{content}</p>
      {fileUrl && fileName && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800"
        >
          <Paperclip size={16} />
          <span>{fileName}</span>
        </a>
      )}
    </div>
  )
} 