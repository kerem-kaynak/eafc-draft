"""
EAFC 25 Player Data Scraper
Fetches all player data from EA's API and exports to CSV
"""

import asyncio
import csv
import json
from typing import Dict, List, Any, Optional
import httpx
from pathlib import Path


class EAFCPlayerScraper:
    def __init__(self):
        self.base_url = "https://drop-api.ea.com/rating/ea-sports-fc"
        self.headers = {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'dnt': '1',
            'origin': 'https://www.ea.com',
            'priority': 'u=1, i',
            'referer': 'https://www.ea.com/',
            'sec-ch-ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            'x-feature': '{"enable_age_gate":true,"enable_age_gate_refactor":false,"enable_college_football_ratings":false,"enable_currency":false,"enable_events_page":true,"enable_fc_mobile_game_languages":true,"enable_glacier":false,"enable_im_resize_query_param":true,"enable_language_redirection":true,"enable_legal_disclaimer_page":false,"enable_mobile_download_flow_optimization":false,"enable_newsletter":true,"enable_newsletter_with_incentive":false,"enable_player_stats":false,"enable_portal":false,"enable_spotlight_carousel":false,"enable_translations_api_route":false,"enable_ugc_page":false,"enable_ugx":false}'
        }
        self.players_data = []

    async def fetch_page(self, client: httpx.AsyncClient, offset: int = 0, limit: int = 100) -> Optional[Dict]:
        """Fetch a single page of player data"""
        params = {
            'locale': 'en',
            'limit': limit,
            'gender': 0,  # Men's football
            'offset': offset
        }
        
        try:
            response = await client.get(self.base_url, params=params, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"HTTP error fetching offset {offset}: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"JSON decode error at offset {offset}: {e}")
            return None

    def extract_player_data(self, player: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and flatten relevant player data"""
        extracted = {
            'id': player.get('id'),
            'overall_rating': player.get('overallRating'),
            'first_name': player.get('firstName'),
            'last_name': player.get('lastName'),
            'common_name': player.get('commonName'),
            'skill_moves': player.get('skillMoves'),
            'weak_foot': player.get('weakFootAbility'),
            'preferred_foot': player.get('preferredFoot'),
            'league_name': player.get('leagueName'),
            'avatar_url': player.get('avatarUrl'),
            'shield_url': player.get('shieldUrl'),
        }

        # Extract alternate positions
        alt_positions = player.get('alternatePositions') or []
        alt_pos_labels = [pos.get('shortLabel', '') for pos in alt_positions if pos]
        extracted['alternate_positions'] = '|'.join(alt_pos_labels) if alt_pos_labels else ''

        # Extract player abilities
        abilities = player.get('playerAbilities') or []
        ability_labels = [ability.get('label', '') for ability in abilities if ability]
        ability_images = [ability.get('imageUrl', '') for ability in abilities if ability]
        extracted['player_abilities_labels'] = '|'.join(ability_labels) if ability_labels else ''
        extracted['player_abilities_images'] = '|'.join(ability_images) if ability_images else ''

        # Extract nationality
        nationality = player.get('nationality') or {}
        extracted['nationality_label'] = nationality.get('label', '')
        extracted['nationality_image_url'] = nationality.get('imageUrl', '')

        # Extract team
        team = player.get('team') or {}
        extracted['team_label'] = team.get('label', '')
        extracted['team_image_url'] = team.get('imageUrl', '')

        # Extract position
        position = player.get('position') or {}
        extracted['position_short_label'] = position.get('shortLabel', '')

        # Extract all stats
        stats = player.get('stats') or {}
        for stat_name, stat_data in stats.items():
            if isinstance(stat_data, dict) and 'value' in stat_data:
                extracted[f'stat_{stat_name}'] = stat_data['value']

        return extracted

    async def fetch_all_players(self):
        """Fetch all players using pagination"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            offset = 0
            limit = 100
            total_fetched = 0

            print("Starting to fetch player data...")

            while True:
                print(f"Fetching page at offset {offset}...")
                
                data = await self.fetch_page(client, offset, limit)
                if not data:
                    print(f"Failed to fetch data at offset {offset}")
                    break

                items = data.get('items', [])
                if not items:
                    print("No more items found. Scraping complete!")
                    break

                # Process players from this page
                for player in items:
                    player_data = self.extract_player_data(player)
                    self.players_data.append(player_data)

                total_fetched += len(items)
                print(f"Fetched {len(items)} players (total: {total_fetched})")

                # Check if we got fewer items than requested (last page)
                if len(items) < limit:
                    print("Reached last page!")
                    break

                offset += limit

                # Add small delay to be respectful
                await asyncio.sleep(0.5)

        print(f"Total players scraped: {len(self.players_data)}")

    def save_to_csv(self, filename: str = "eafc_players.csv"):
        """Save player data to CSV file"""
        if not self.players_data:
            print("No data to save!")
            return

        # Get all unique field names
        all_fields = set()
        for player in self.players_data:
            all_fields.update(player.keys())
        
        # Sort fields for consistent column order
        fieldnames = sorted(list(all_fields))

        # Write to CSV
        output_path = Path(filename)
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(self.players_data)

        print(f"Data saved to {output_path}")
        print(f"Total columns: {len(fieldnames)}")
        print(f"Total rows: {len(self.players_data)}")

    async def run(self):
        """Main execution method"""
        await self.fetch_all_players()
        self.save_to_csv()


async def main():
    scraper = EAFCPlayerScraper()
    await scraper.run()


if __name__ == "__main__":
    asyncio.run(main())