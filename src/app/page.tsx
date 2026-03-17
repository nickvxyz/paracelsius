import MascotPlaceholder from "@/components/MascotPlaceholder";
import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center gap-12 px-6 py-16">
      <MascotPlaceholder />
      <ChatWindow />
    </div>
  );
}
