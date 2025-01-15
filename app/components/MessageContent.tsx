import { Paperclip } from 'lucide-react'
import { useState } from 'react'

interface MessageContentProps {
  content: string
  fileUrl?: string | null
  fileName?: string | null
  onImageLoad?: () => void
}

export default function MessageContent({ content, fileUrl, fileName, onImageLoad }: MessageContentProps) {
  const isImageFile = fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  const renderContent = () => {
    // Split content into text and mention parts using @[username] format
    const parts = content.split(/(@\[[^\]]+\])/g)
    const renderedContent = (
      <div className="whitespace-pre-wrap mb-2">
        {parts.map((part, index) => {
          // Match @[username] format
          const match = part.match(/@\[([^\]]+)\]/)
          if (match) {
            const username = match[1] // Extract username from @[username]
            return (
              <span
                key={index}
                className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded mx-0.5"
              >
                @{username}
              </span>
            )
          }
          return <span key={index}>{part}</span>
        })}
      </div>
    )

    if (fileUrl && isImageFile) {
      return (
        <div className="space-y-2">
          {renderedContent}
          <div 
            className="w-fit h-[300px] bg-gray-50 rounded-lg relative overflow-hidden"
            style={{ minWidth: '200px' }}
          >
            <img
              src={fileUrl}
              alt={fileName || 'Attached image'}
              className={`
                message-image
                h-[300px] w-auto object-contain
                transition-opacity duration-300 ease-in-out
                ${isImageLoaded ? 'opacity-100' : 'opacity-0'}
              `}
              onLoad={() => {
                setIsImageLoaded(true)
                onImageLoad?.()
              }}
              style={{
                aspectRatio: 'auto',
                minHeight: '300px'
              }}
            />
            {!isImageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse text-gray-400">Loading...</div>
              </div>
            )}
          </div>
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center text-sm text-blue-500 hover:text-blue-600"
          >
            <Paperclip size={16} className="mr-1" />
            {fileName || 'Download image'}
          </a>
        </div>
      )
    }
    
    return renderedContent
  }

  return (
    <div className="space-y-2">
      {renderContent()}
      
      {fileUrl && !isImageFile && (
        <div className="mt-2">
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center text-sm text-blue-500 hover:text-blue-600"
          >
            <Paperclip size={16} className="mr-1" />
            {fileName || 'Download file'}
          </a>
        </div>
      )}
    </div>
  )
} 