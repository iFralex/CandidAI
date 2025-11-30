import Link from "next/link";

export default function DocumentList({ documents }) {
  
   documents = [
     { id: 1, title: "Complete Platform Documentation", slug: "complete-platform-documentation" },
     //{ id: 2, title: "Documento 2", slug: "documento-2" },
   ]

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">CandidAI Documents</h2>
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id}>
            <Link
              href={`/docs/${doc.slug}`}
              className="block px-4 py-2 rounded hover:bg-gray-700 hover:text-white transition-colors"
            >
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
