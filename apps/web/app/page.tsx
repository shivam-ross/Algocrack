import { Problems } from "./components/problemsTable";
import { Topbar } from "./components/topbar";

export default function Home() {
  return (
   <div className="items-center bg-purple-200 "> 
    <Topbar/>
    <Problems/>
   </div>
  );
}
