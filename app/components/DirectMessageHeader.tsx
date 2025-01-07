export default function DirectMessageHeader({ conversation }: DirectMessageHeaderProps) {
  return (
    <div className="h-16 px-6 flex items-center border-b border-gray-200 bg-white">
      <div className="flex items-center">
        {conversation.other_user.avatar_url && (
          <img
            src={conversation.other_user.avatar_url}
            alt=""
            className="w-8 h-8 rounded-lg mr-2 object-cover"
          />
        )}
        <span className="font-medium">
          {conversation.other_user.username}
        </span>
      </div>
    </div>
  )
} 