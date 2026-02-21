export const EMOJI_LIST: { emoji: string; name: string; tags: string[] }[] = [
  { emoji: "🔥", name: "fire", tags: ["hot", "trend", "viral"] },
  { emoji: "🚀", name: "rocket", tags: ["launch", "growth", "startup"] },
  { emoji: "✅", name: "check", tags: ["done", "success", "confirm"] },
  { emoji: "⚡", name: "zap", tags: ["fast", "energy", "power"] },
  { emoji: "💡", name: "idea", tags: ["tip", "insight", "brain"] },
  { emoji: "📌", name: "pin", tags: ["important", "note"] },
  { emoji: "📈", name: "chart", tags: ["growth", "business", "stats"] },
  { emoji: "📉", name: "down chart", tags: ["drop", "loss"] },
  { emoji: "🧠", name: "brain", tags: ["smart", "learning"] },
  { emoji: "🎯", name: "target", tags: ["goal", "focus"] },
  { emoji: "💬", name: "speech", tags: ["comment", "talk"] },
  { emoji: "📝", name: "note", tags: ["write", "content"] },
  { emoji: "📣", name: "megaphone", tags: ["marketing", "announce"] },
  { emoji: "🔗", name: "link", tags: ["url", "connect"] },
  { emoji: "😄", name: "smile", tags: ["happy"] },
  { emoji: "😂", name: "laugh", tags: ["funny"] },
  { emoji: "🤯", name: "mind blown", tags: ["shock", "wow"] },
  { emoji: "🙌", name: "hands", tags: ["celebrate", "win"] },
  { emoji: "❤️", name: "heart", tags: ["love", "like"] },
  { emoji: "⭐", name: "star", tags: ["favorite", "rating"] },
  { emoji: "⚠️", name: "warning", tags: ["alert", "careful"] },
  { emoji: "👀", name: "eyes", tags: ["look", "see"] },
  { emoji: "📍", name: "location", tags: ["map", "pin"] },
  { emoji: "🎥", name: "video", tags: ["youtube", "content"] },
  { emoji: "📸", name: "camera", tags: ["instagram", "photo"] },
  { emoji: "🧵", name: "thread", tags: ["twitter", "x"] },
  { emoji: "🏆", name: "trophy", tags: ["win", "success"] }
];

export function countEmojis(text: string): number {
  // Rough emoji count: counts codepoints in emoji ranges
  const m = text.match(/[\u{1F300}-\u{1FAFF}]/gu);
  return m ? m.length : 0;
}