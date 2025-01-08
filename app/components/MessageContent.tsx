import { Paperclip } from 'lucide-react'

interface MessageContentProps {
  content: string
  fileUrl?: string | null
  fileName?: string | null
}

export default function MessageContent({ content, fileUrl, fileName }: MessageContentProps) {
  const isImageFile = fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

  return (
    <div className="space-y-2">
      <div className="whitespace-pre-wrap">{content}</div>
      
      {fileUrl && (
        <div className="mt-2">
          {isImageFile ? (
            <div className="space-y-2">
              <img 
                src={fileUrl} 
                alt={fileName || 'Attached image'} 
                className="max-w-sm rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              />
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
          ) : (
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center text-sm text-blue-500 hover:text-blue-600"
            >
              <Paperclip size={16} className="mr-1" />
              {fileName || 'Download file'}
            </a>
          )}
        </div>
      )}
    </div>
  )
} 