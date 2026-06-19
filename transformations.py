import json
import re
import networkx as nx

def extract_weight(pub_string):
    """Extracts the first integer from a string like '2 resultado de...'"""
    if type(pub_string) == int:
        return pub_string 
    if not pub_string:
        return 1 # Default to 1 if missing
    match = re.search(r'\d+', pub_string)
    return int(match.group()) if match else 1

def transform_to_d3_network(input_filepath, output_filepath):
    # 1. Load the raw JSON data
    with open(input_filepath, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    nodes_dict = {}
    links = []

    # 2. Process each main faculty member
    for faculty in raw_data:
        faculty_id = faculty.get("name")
        if not faculty_id:
            continue

        # Add or update the main faculty node
        nodes_dict[faculty_id] = {
            "id": faculty_id,
            "type": "UTEC Faculty",
            "group": 1,
            "dept": faculty.get("dept"),
            "h_index": faculty.get("h-index"),
            "citations": faculty.get("citations"),
            "photo_url": faculty.get("photo_url"),
            "bio": faculty.get("bio"),
            "areas": faculty.get("areas"),
        }

        # 3. Process Individual Collaborators
        for colab in faculty.get("collaborators", []):
            colab_id = colab.get("colaborador")
            if not colab_id:
                continue
                
            # Add collaborator to nodes if not already present
            if colab_id not in nodes_dict:
                nodes_dict[colab_id] = {
                    "id": colab_id,
                    "type": "External Researcher",
                    "group": 2,
                    "h_index": None, # Missing in raw data for external folks
                    "citations": None
                }
            
            weight = extract_weight(colab.get("num_publicaciones", ""))
            links.append({
                "source": faculty_id,
                "target": colab_id,
                "weight": weight
            })

        for ext_org in faculty.get("external_orgs", []):
            org_id = ext_org.get("organizacion")
            if not org_id:
                continue
                
            if org_id not in nodes_dict:
                nodes_dict[org_id] = {
                    "id": org_id,
                    "type": "External Organization",
                    "group": 3
                }
            
            weight = extract_weight(ext_org.get("num_publications", ""))
            links.append({
                "source": faculty_id,
                "target": org_id,
                "weight": weight
            })
            
        for int_org in faculty.get("internal_orgs", []):
            org_id = int_org.get("centro")
            if not org_id:
                continue
                
            if org_id not in nodes_dict:
                nodes_dict[org_id] = {
                    "id": org_id,
                    "type": "Internal Organization",
                    "group": 4
                }
            
            weight = extract_weight(int_org.get("num_publications", ""))
            links.append({
                "source": faculty_id,
                "target": org_id,
                "weight": weight
            })

    G = nx.Graph()
    for link in links:
        G.add_edge(link["source"], link["target"], weight=link["weight"])

    degree_centrality = nx.degree_centrality(G)
    betweenness_centrality = nx.betweenness_centrality(G, weight="weight")

    for node_id, node_data in nodes_dict.items():
        node_data["degree_centrality"] = round(degree_centrality.get(node_id, 0), 4)
        node_data["betweenness_centrality"] = round(betweenness_centrality.get(node_id, 0), 4)

    d3_data = {
        "nodes": list(nodes_dict.values()),
        "links": links
    }

    with open(output_filepath, 'w', encoding='utf-8') as f:
        json.dump(d3_data, f, indent=4, ensure_ascii=False)
        
    print(f"Success! Processed {len(d3_data['nodes'])} nodes and {len(d3_data['links'])} links.")
    print(f"Saved D3-ready JSON to: {output_filepath}")

if __name__ == "__main__":
    # with open('data/transformed/profile.json', 'r', encoding='utf-8') as f: profile = json.load(f)
    # with open('data/transformed/utec_d3_network.json', 'r', encoding='utf-8') as f: profile = json.load(f)
    # Ensure you have saved your raw JSON into a file named 'raw_data.json' in the same directory
    transform_to_d3_network('data/transformed/profile.json', 'data/transformed/utec_d3_network.json')