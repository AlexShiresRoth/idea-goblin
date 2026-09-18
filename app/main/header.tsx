import CreateIdeaModal from "../components/create-idea-modal";
import Container from "./container";
import Sidebar from "./sidebar";
import SignoutButton from "./signout-button";

export default function Header({ name }: { name: string }) {
  return (
    <header className="flex w-full items-center border-b border-white/10">
      <Sidebar>
        <div className="flex items-center justify-center p-4 border-r border-white/10 flex-1">
          <h1 className="text-lg font-bold">Idea Goblin</h1>
        </div>
      </Sidebar>
      <Container>
        <div className="flex items-center gap-8 p-3 px-4 flex-1">
          <p className="text-sm">{name}</p>
          <CreateIdeaModal type="inline" />
        </div>
        <div className="md:hidden flex justify-end">
          <SignoutButton />
        </div>
      </Container>
    </header>
  );
}
