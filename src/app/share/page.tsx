import { SetPriceForm } from "@/components/SetPriceForm";
import { PostChecker } from "@/components/PostChecker";

export default function SharePage() {
  return (
    <>
      <h1>Share a post</h1>
      <PostChecker />
      <SetPriceForm />
    </>
  );
}
