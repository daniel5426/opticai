#!/usr/bin/env python3
"""Configure named outputs through the public SDK until Workflow YAML supports exports."""
import argparse
from copy import deepcopy
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def graph_with_outputs(graph, exports):
    result = deepcopy(graph)
    nodes = {node['id']: node for node in result['nodes']}
    contract = result.setdefault('workflow_contract', {})
    declared = contract.setdefault('exports', {})
    for name, export in exports.items():
        source = export['source']
        if nodes.get(source['node_id'], {}).get('type') != 'speech_to_text':
            raise ValueError('The transcript producer must be the existing Speech to Text node.')
        if name in declared:
            existing = declared[name]
            # Value references acquire optional label/type metadata on server normalization.
            if all(existing.get('source', {}).get(key) == value for key, value in source.items()) and existing.get('representation', 'value') == export['representation']:
                continue
            raise ValueError('An existing named output differs; review it before replacing it.')
        declared[name] = deepcopy(export)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', default=str(ROOT / 'backend/.env'))
    parser.add_argument('--apply', action='store_true', help='Save the export in the existing Agent draft')
    parser.add_argument('--publish', action='store_true', help='Publish the Agent draft, including any existing draft changes')
    args = parser.parse_args()
    if args.publish and not args.apply:
        parser.error('--publish requires --apply')
    from dotenv import dotenv_values
    from agents24 import Agents24
    env = {**dotenv_values(args.env_file), **os.environ}
    import requests
    with requests.Session() as session:
        client = Agents24(base_url=env['AGENTS24_BASE_URL'], api_key=env['AGENTS24_API_KEY'], session=session)
        agent_id = env['AGENTS24_AGENT_ID']
        agent = client.agents.get(agent_id)
        exports = json.loads((ROOT / 'config/agents24-outputs.json').read_text())
        graph = graph_with_outputs(agent['graph_definition'], exports)
        changed = graph != agent['graph_definition']
        preexisting = bool(agent.get('has_unpublished_changes'))
        if args.apply and changed:
            client.agents.update_graph(agent_id, graph)
        if args.apply:
            validation = client.agents.validate(agent_id)
            if not validation.get('valid'):
                raise RuntimeError('Agent validation failed; publication was not attempted.')
        if args.publish:
            agent = client.agents.publish(agent_id)
        print(json.dumps({'agent_id': agent_id, 'exports': list(exports), 'changed': changed,
            'applied': args.apply, 'published': args.publish,
            'preexisting_draft_changes': preexisting}))


if __name__ == '__main__':
    main()
