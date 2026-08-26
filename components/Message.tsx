import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "./Chat";

export default function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="message user">
        <div className="message-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="message assistant">
      <div className="ai-avatar">F</div>
      <div className="message-bubble markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
