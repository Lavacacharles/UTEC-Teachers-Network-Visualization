import urllib.parse
import asyncio
from pathlib import Path
import json
import logging
import os
import random
import nodriver
import re
from bs4 import BeautifulSoup

from IPython.display import display
# Modular imports
from browser_helper import find_chrome_binary, goto_page
from parser import (
    parse_directory,
    parse_profile,
    parse_collaborators,
    parse_fingerprints,
    get_next_page_url
)

def get_professors_links():

    output_path: str = None
    max_profiles: int = None

    base_url = "https://cris.utec.edu.pe"
    directory_url = "https://cris.utec.edu.pe/es/persons/"
    output_path = output_path or os.path.join("data", "raw_collection.json")
    max_profiles = max_profiles
    delay_minimum = 2.0
    delay_maximum = 4.5
    list_selector = "a.link.person"
    profile_selector = "h1"
    display(f'''
        {"base_url:":<18}{base_url}
        {"directory_url:":<18}{directory_url}
        {"output_path:":<18}{output_path}
        {"max_profiles:":<18}{max_profiles}
        {"delay_minimum:":<18}{delay_minimum}
        {"delay_maximum:":<18}{delay_maximum}
        {"list_selector:":<18}{list_selector}
        {"profile_selector:":<18}{profile_selector}
    ''')

    loop = asyncio.get_event_loop()
    chrome_path = os.environ.get("CHROME_PATH") or find_chrome_binary()
    browser = loop.run_until_complete(
        nodriver.start(
            headless=False,
            lang="es-PE",
            browser_executable_path=chrome_path,
            browser_args=["--start-maximized"],
        )
    )
    tab = browser.main_tab

    success = loop.run_until_complete(
        goto_page(
            tab, directory_url,
            delay_minimum, delay_maximum,
            content_timeout=120, selector=list_selector
        )
    )
    if not success:
        print("Persons directory list never loaded.")
        browser.stop()

    professors_list = []
    page_number = 1


    # LOOP FOR ALL PROFESSORS

    while True:
        directory_html = loop.run_until_complete(tab.get_content())
        batch_professors = parse_directory(directory_html, base_url)
        professors_list.extend(batch_professors)


        print("Page %d: +%d persons (total %d)", page_number, len(batch_professors), len(professors_list))

        next_url = get_next_page_url(directory_html, base_url)

        if not next_url:
            print("  Last directory page reached.")
            break

        success = loop.run_until_complete(
            goto_page(
                tab, 
                next_url, 
                delay_minimum, 
                delay_maximum, 
                selector=list_selector
                )
            )
        if not success:
            raise RuntimeError('Failed fetching next page')
            # break
        page_number += 1

    pd = Path('data')
    pd.mkdir(parents=True, exist_ok=True)

    with open(str(pd / 'main_page_professors.json'),'w', encoding="utf-8") as f: json.dump(professors_list, f, indent=4, ensure_ascii=False)


def get_html_on_link(tab, loop, professor_info, delay_minimum, delay_maximum, specific_selector, add_link=''):
    # [FIX 1] Safely construct the URL to guarantee the slash is present
    base_url = professor_info["profile_url"].strip()
    if not base_url.endswith('/'):
        base_url += '/'
    target_url = urllib.parse.urljoin(base_url, add_link)
    # FLAG: Print the exact URL being evaluated
    print(f"  -> [ATTEMPTING] {target_url} (Waiting for: '{specific_selector}')")
    success = loop.run_until_complete(
        goto_page(
            tab, 
            target_url,
            delay_minimum, 
            delay_maximum,
            content_timeout=20, 
            selector=specific_selector
        )
    )
    if not success:
        # FLAG: Clear alert on failure
        print(f"  -> [FAILED] Timeout or missing selector '{specific_selector}' on {target_url}")
        return None   
    return loop.run_until_complete(tab.get_content())

# if '__main__'
output_path: str = None
max_profiles: int = None

base_url = "https://cris.utec.edu.pe"
directory_url = "https://cris.utec.edu.pe/es/persons/"
output_path = output_path or os.path.join("data", "raw_collection.json")
max_profiles = max_profiles
delay_minimum = 2.0
delay_maximum = 4.5
list_selector = "a.link.person"
profile_selector = "h1"
display(f'''
    {"base_url:":<18}{base_url}
    {"directory_url:":<18}{directory_url}
    {"output_path:":<18}{output_path}
    {"max_profiles:":<18}{max_profiles}
    {"delay_minimum:":<18}{delay_minimum}
    {"delay_maximum:":<18}{delay_maximum}
    {"list_selector:":<18}{list_selector}
    {"profile_selector:":<18}{profile_selector}
''')

loop = asyncio.get_event_loop()
chrome_path = os.environ.get("CHROME_PATH") or find_chrome_binary()
browser = loop.run_until_complete(
    nodriver.start(
        headless=False,
        lang="es-PE",
        browser_executable_path=chrome_path,
        browser_args=["--start-maximized"],
    )
)
tab = browser.main_tab
success = loop.run_until_complete(
    goto_page(
        tab, directory_url,
        delay_minimum, delay_maximum,
        content_timeout=120, selector=list_selector
    )
)

if not success:
    print("Persons directory list never loaded.")
    browser.stop()
    
with open('data/main_page_professors.json','r', encoding="utf-8") as f: professors_list = json.load(f)


enriched_results = []
for index, professor_info in enumerate(professors_list):
    print(f"\n[{index + 1}/{len(professors_list)}] Scraping details for: {professor_info['name']}")
    # 1. MAIN PROFILE
    html_content = get_html_on_link(tab, loop, professor_info, delay_minimum, delay_maximum, profile_selector, add_link='')
    # [FIX 2] Stop script from crashing if None is returned
    if not html_content:
        print(f"  -> [SKIP] Main profile failed. Skipping {professor_info['name']}.")
        continue
    soup = BeautifulSoup(html_content, "lxml")
    # Pre-instantiated payload
    info = {
        **professor_info,
        "areas": [], "orcid": None, "scholar_url": None, "scopus_url": None,
        "linkedin_url": None, "bio": None, 'h-index': None, 'citations': None,
        "education": [], "fingerprints": [], "collaborators": [],
        "internal_orgs": [], "external_orgs": []
    }
    # Email fallback
    email_desc = soup.find('span', class_='description')
    info["email"] = email_desc.text.strip() if email_desc is not None else None
    # Photo fallback 
    img_element = soup.find('img', attrs={'loading': 'lazy'})
    if img_element and img_element.get('src'):
        info["photo_url"] = base_url + img_element['src']
    else:
        info["photo_url"] = None
    # External Links - Robust Fallbacks
    scopus_p = soup.find('p', class_="scopus-link")
    scopus_a = scopus_p.find('a') if scopus_p else None
    info["scopus_url"] = scopus_a['href'] if scopus_a and scopus_a.has_attr('href') else None
    su = soup.find('a', attrs={'aria-label': 'Google Scholar'})
    info["scholar_url"] = su['href'] if su and su.has_attr('href') else None
    su = soup.find('a', attrs={'aria-label': 'LinkedIn'})
    info["linkedin_url"] = su['href'] if su and su.has_attr('href') else None
    su = soup.find('a', attrs={'aria-label': 'CTI Vitae'})
    info["concytec_url"] = su['href'] if su and su.has_attr('href') else None
    su = soup.find('a', class_="orcid")
    info["orcid"] = su['href'] if su and su.has_attr('href') else None
    # Metrics parsing protected from missing values or empty list max() crashes
    h_metrics = soup.find_all('ul', class_="metrics-list")
    h_index_values = []
    citation_values = []
    for i in h_metrics:
        for j in i.find_all('li'):
            source_div = j.find('div', class_='source')
            value_div = j.find('div', class_='value')
            if source_div and value_div:
                source_text = source_div.text
                if 'ndice' in source_text and value_div.text.strip().isdigit():
                    h_index_values.append(int(value_div.text.strip()))
                if 'Citas' in source_text and value_div.text.strip().isdigit():
                    citation_values.append(int(value_div.text.strip()))
    info['h-index'] = max(h_index_values) if h_index_values else None
    info['citations'] = max(citation_values) if citation_values else None
    # Bio Paragraph safely built
    info["bio"] = '\n'.join([t.text.strip() for t in soup.find_all('div', class_="textblock") if t.text])
    # Research Area Keywords safely extracted
    areas_list = []
    for t in soup.find_all('div', class_='keyword-group'):
        subheader = t.find('h3', class_='subheader')
        if subheader and 'Temas' in subheader.text:
            for j in t.find_all('li'):
                span_el = j.find('span')
                if span_el:
                    areas_list.append(span_el.text.strip())
    info["areas"] = areas_list
    # Education layout safe evaluation
    edu_container = soup.find('div', class_='rendering rendering_person rendering_personeducationrendererportal rendering_person_personeducationrendererportal')
    if edu_container:
        edu_items = edu_container.find_all('div', class_='rendering rendering_personeducation rendering_compact rendering_personeducation_compact')
        education_data = []
        for t in edu_items:
            # Safe extraction flags for subcomponents
            period_el = t.find('span', class_="date")
            univ_el = t.find('span', class_="rendering rendering_inline rendering_ueoexternalorganisation rendering_ueoexternalorganisation_inline")
            titulo_text = ''.join([j for i in t.children if hasattr(i, 'find_all') for j in i.find_all(string=True, recursive=False)]).strip()
            periodo_text = period_el.text.strip() if period_el else None
            univ_text = univ_el.text.strip() if univ_el else None
            education_data.append({
                'titulo': titulo_text,
                'periodo': periodo_text,
                'universidad': univ_text
            })
        info["education"] = education_data
    # --- Section Subpage: Fingerprints ---
    html_content = get_html_on_link(
        tab, loop, professor_info, delay_minimum, delay_maximum, 
        specific_selector="div.person-fingerprints", add_link='fingerprints/'
    )
    if html_content:
        soup = BeautifulSoup(html_content, "lxml")
        fingerprints_container = soup.find('div', class_="person-fingerprints")
        if fingerprints_container:
            fingerprints_data = []
            for s in fingerprints_container.find_all('div', class_='person-fingerprint-thesauri'):
                campo_h3 = s.find('h3')
                campo_text = campo_h3.text.strip() if campo_h3 else "Unknown"
                temas_list = []
                for si in s.find_all('li', class_='concept-badge-small-container dropdown-overflow'):
                    btn = si.find('button')
                    concept_span = si.find('span', class_="concept")
                    if btn and concept_span:
                        temas_list.append({
                            'puntaje': btn.get('data-rank-value', '0'),
                            'nombre': concept_span.text.strip()
                        })
                fingerprints_data.append({'campo': campo_text, 'temas': temas_list})
            info["fingerprints"] = fingerprints_data
    else:
        print("  -> [WARNING] Fingerprints HTML was empty or timed out.")
    # ---------------------------------------------------------
    # 3. SUBPAGE: Network Persons
    html_content = get_html_on_link(
        tab, loop, professor_info, delay_minimum, delay_maximum, 
        specific_selector="div.grid-results", add_link='network-persons/'
    )
    if html_content:
        soup = BeautifulSoup(html_content, "lxml")
        grid_results = soup.find('div', class_="grid-results")
        if grid_results:
            collaborators_data = []
            for s in grid_results.find_all('div', class_="grid-result-item"):
                title_h2 = s.find('h2', class_="title")
                puesto_p = s.find('p', class_="type")
                pub_ul = s.find('ul', class_="inline-relations")
                collaborators_data.append({
                    'colaborador': title_h2.text.strip() if title_h2 else None,
                    'research_center': list(set([i.text.strip() for i in s.find_all('ul', class_="relations") if i.text])),
                    'puesto': puesto_p.text.strip() if puesto_p else None,
                    'num_publicaciones': pub_ul.text.strip() if pub_ul else None
                })
            info["collaborators"] = collaborators_data
    else:
        print("  -> [WARNING] Network Persons HTML was empty or timed out.")
    # ---------------------------------------------------------
    # 4. SUBPAGE: Network Organisations
    html_content = get_html_on_link(
        tab, loop, professor_info, delay_minimum, delay_maximum, 
        specific_selector="div.network-profiled-institutions", add_link='network-organisations/'
    )
    if html_content:
        soup = BeautifulSoup(html_content, "lxml")
        # Internal Orgs Block
        internal_container = soup.find('div', class_="network-profiled-institutions")
        if internal_container:
            internal_data = []
            for s in internal_container.find_all('div', class_="grid-result-item"):
                title_h2 = s.find('h2', class_="title")
                rel_p = s.find('p', class_="relations")
                type_p = s.find('p', class_="type")
                pub_ul = s.find('ul', class_="inline-relations")
                internal_data.append({
                    'centro': title_h2.text.strip() if title_h2 else None,
                    'organizacion': rel_p.text.strip() if rel_p else None,
                    'descripcion': type_p.text.strip() if type_p else None,
                    'num_publications': pub_ul.text.strip() if pub_ul else None
                })
            info['internal_orgs'] = internal_data
        # External Orgs Block
        external_container = soup.find('div', class_="network-nonprofiled-institutions")
        if external_container:
            external_data = []
            for s in external_container.find_all('div', class_="grid-result-item"):
                title_h2 = s.find('h2', class_="title")
                pub_ul = s.find('ul', class_="inline-relations") 
                external_data.append({
                    'organizacion': title_h2.text.strip() if title_h2 else None,
                    'num_publications': pub_ul.text.strip() if pub_ul else None
                })
            info['external_orgs'] = external_data
    else:
        print("  -> [WARNING] Network Organisations HTML was empty or timed out.")
    # Visual Output Stream Formatting
    for k, v in info.items():
        print(f'{k:>50}: {v}')
    enriched_results.append(info)


browser.stop()


with open('data/detail_professors_description.json', 'w', encoding='utf-8') as f: json.dump(enriched_results, f, indent=4, ensure_ascii=False)
