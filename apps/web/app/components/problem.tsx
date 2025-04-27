const difficultyColors = {
    EASY: "text-green-600",
    MEDIUM: "text-yellow-600",
    HARD: "text-red-600",
};

export function Problem ({title, difficulty, tags}:{title:string, difficulty: 'EASY' | 'MEDIUM' | 'HARD', tags: string}) {
    return (
        <div className="grid grid-cols-3 w-full justify-items-center my-2 px-3 border-b py-2 mx-3">
                  <h2 className="text-md text-black justify-self-start">{title}</h2>
                  <h2 className={`text-md ${difficultyColors[difficulty]}`}>{difficulty}</h2>
                  <h2 className="text-md text-gray-800">{tags}</h2>
                </div>
    )
}