## graphify

Always-on knowledge graph for this project. Before answering questions about the codebase, consult the graph instead of re-reading files.

- Query the graph: `graphify query "your question"` — uses graphify-out/graph.json
- After code changes, rebuild: `graphify update` (or the post-commit hook does it automatically)
- The graph lives in graphify-out/ (gitignored)
- God nodes, communities, and surprising connections are in graphify-out/GRAPH_REPORT.md
