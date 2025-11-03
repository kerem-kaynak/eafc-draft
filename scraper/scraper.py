"""
EAFC 26 Player Data Scraper
Fetches all player data from EA's API and exports to CSV
"""

import asyncio
import csv
import json
import re
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
            'sec-ch-ua': '"Chromium";v="141", "Not?A_Brand";v="8"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'x-feature': '{"disable_share_image":false,"drop-8104":false,"drop-8334":false,"enable_access_site":true,"enable_age_gate":true,"enable_age_gate_refactor":true,"enable_bf2042_glacier_theme":false,"enable_checkout_page":true,"enable_college_football_ratings":true,"enable_currency":false,"enable_events_page":true,"enable_franchise_hub":false,"enable_franchise_newsletter":true,"enable_im_resize_query_param":true,"enable_language_redirection":true,"enable_legal_disclaimer_page":false,"enable_multimedia_consent":true,"enable_newsletter_with_incentive":true,"enable_next_ratings_release":true,"enable_non_mobile_download_flow_optimization":true,"enable_page_level_theming":true,"enable_player_tag":true,"enable_portal":true,"enable_portal_filter":false,"enable_portal_maps_rotation":true,"enable_postlaunch_webstore_focus":true,"enable_postlaunch_webstore_image_link_ab_test":false,"enable_postlaunch_webstore_pdp_promotion":true,"enable_ratings_up_down_vote":false,"enable_showcase_edition":true,"enable_spotlight_carousel":true,"enable_translations_api_route":false,"enable_ugc_page":true,"enable_ugx":false}'
        }
        self.players_data = []

    def convert_fc25_to_fc26_urls(self, avatar_url: Optional[str], shield_url: Optional[str]) -> tuple[Optional[str], Optional[str]]:
        """Convert FC25 URLs to FC26 format
        
        Avatar: FC25/full/player-portraits/p{id}.png -> FC26/components/players/p{id}.webp
        Shield: FC25/full/player-shields/en/{id}.png -> FC26/components/items/{id}_en.webp
        """
        converted_avatar = None
        converted_shield = None
        
        if avatar_url:
            # Extract player ID from avatar URL (e.g., p209331)
            match = re.search(r'p(\d+)\.png', avatar_url)
            if match:
                player_id = match.group(0).replace('.png', '')  # Gets 'p209331'
                converted_avatar = f"https://ratings-images-prod.pulse.ea.com/FC26/components/players/{player_id}.webp"
        
        if shield_url:
            # Extract player ID from shield URL (e.g., 209331)
            match = re.search(r'/(\d+)\.png', shield_url)
            if match:
                player_id = match.group(1)  # Gets '209331'
                converted_shield = f"https://ratings-images-prod.pulse.ea.com/FC26/components/items/{player_id}_en.webp"
        
        return converted_avatar, converted_shield

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
        # Convert FC25 URLs to FC26 format
        avatar_url, shield_url = self.convert_fc25_to_fc26_urls(
            player.get('avatarUrl'),
            player.get('shieldUrl')
        )
        
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
            'avatar_url': avatar_url,
            'shield_url': shield_url,
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