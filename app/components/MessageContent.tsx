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
    // Always render the content text if it exists
    const textContent = content ? (
      <div className="whitespace-pre-wrap mb-2">{content}</div>
    ) : null

    if (fileUrl && isImageFile) {
      return (
        <div className="space-y-2">
          {textContent} {/* Show text content above image if it exists */}
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
    
    return textContent || <div>No content</div>
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