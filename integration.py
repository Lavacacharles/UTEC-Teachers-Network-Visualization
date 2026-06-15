from IPython.display import display
from urllib.parse import unquote
from copy import copy
import re
import json 
import os 
from pathlib import Path 
from collections import Counter
import numpy as np
import pandas as pd
import unicodedata

def limpiar_texto_url(texto):
    if not texto:
        return texto
    texto = unquote(texto)
    texto = ' '.join(texto.split())    
    return texto.strip()



info_professors = []
with open('data/raw/detail_professors_description.json', 'r', encoding='utf-8') as f: info_professors = json.load(f)

# info_professors[0]
# len(info_professors)

# check = Counter([
#     # i.__class__.__name__
#     (k, v.__class__.__name__)
#     for prof_info in info_professors
#     for k,v in prof_info.items()
# ])
# df = pd.DataFrame([{'key':k,'class':v,'count':c} for (k,v),c in check.items()])
# set_keys = df[df['class'] == 'str']['key'].unique()

# display('\n'.join(df[df['class'].isin(['str', 'int'])]['key'].tolist()))

# df[df['key'].isin(set_keys)].sort_values(by=['key'])
# df[df['class']=='NoneType'][['key', 'email']]
# df[['profile_url']]

# with open('data/transformed/profile.json', 'w', encoding='utf-8') as f: json.dump(profile.to_dict(orient='records'),f, indent=4, ensure_ascii=False)
# profile.to_csv('data/profile.csv', index=False)


def split_orgs(text):
    s = list(set([
        "IP", "aM", "úI", "úU", "oU", "lG", "rU", "lG", "aG", "rC", "rD", "oU", "aU", "yJ", "gG", "rU", "eR", 
        "lU", "sU", "aC", "rG", "yE", "oC", "oD", "yU", ")U", "SU", ")F", "rB", "CC", "xU", "aS", "nU", "IS", 
        "IU", "oG", "hU", "3U","lC","áD","sK","eU","dU","lI","uU","CS","eD","sI","éN","eN","tC","yN","lL"
        ])) 
    temp = copy(text).replace('Tecnologfa','Tecnología').replace('Tecnologia', 'Tecnología').replace('Ingenieria', 'Ingeniería')
    for i_s in s:
        if i_s in temp:
            temp = temp.replace(i_s, i_s[0]+';'+i_s[1])
    temp = temp.replace('Universidad de Ingenierfa y Tecnología', 'Universidad de Ingeniería y Tecnología - UTEC')
    temp = temp.replace('omieAstrono','omie;Astrono').replace('PauloNew','Paulo;New').replace('UTECUniversidad','UTEC;Universidad')
    temp = temp.replace('R.LUniv','R.L;Univ').replace('ECRED YAKUUn','EC;RED YAKU;Un').replace('CollegeWest','College;West')
    temp = temp.replace('ResearchRegional','Research;Regional').replace('EA)ATUK C','EA);ATUK;C')
    temp = temp.replace('ollo(ANID/','ollo;(ANID/').replace('ulouse–CNRS–IR', 'ulouse;CNRS–IR')
    temp = temp.replace('IRD/Univ', 'IRD;Univ').replace('HEA)Andu','HEA);Andu').replace('MadridSICPA','Madrid;SICPA')
    temp = temp.replace('TechnologyPhilips','Technology;Philips').replace('AndesPontificia','Andes;Pontificia')
    temp = temp.replace('EngineeringL.E.K.','Engineering;L.E.K.').replace('TechnologyShennon','Technology;Shennon')
    temp = temp.replace('BiotechnologiesShennon','Biotechnologies;Shennon').replace('MedicineEmory', 'Medicine;Emory')
    temp = temp.replace('TechnologyGeorgia','Technology;Georgia').replace('UniversityMerck','University;Merck')
    temp = temp.replace('EngineeringEmory','Engineering;Emory').replace('TechnologyShanghai','Technology;Shanghai')
    temp = temp.replace('Technologiesdept','Technologies;dept').replace('TrustImperial','Trust;Imperial')
    temp = temp.replace('UOITFaculty','UOIT;Faculty').replace('MITUniversidade','MIT;Universidade')
    temp = temp.replace('SulPrimary','Sul;Primary').replace('SystemSao','System;Sao').replace('InstituteHigher','Institute;Higher')
    temp = temp.replace('UNIEconometric','UNI;Econometric').replace('GroupEconometric','Group;Econometric')
    temp = temp.replace('OxfordMansfield', 'Oxford;Mansfield'). replace('CollegePontifícia', 'College;Pontifícia')
    temp = temp.replace('CambridgeIITP','Cambridge;IITP').replace('CenterPolytechnique','Center;Polytechnique')
    temp = temp.replace('CenterInstitute','Center;Institute').replace('InstitutThe','Institut;The').replace('NetworkChinese','Network;Chinese')
    temp = temp.replace('SciencesNational','Sciences;National').replace('HeidelbergAstronomisches','Heidelberg;Astronomisches')
    temp = temp.replace('UNICAMP)ETH', 'UNICAMP);ETH').replace('AmsterdamUniversidad','Amsterdam;Universidad')
    temp = temp.replace('NavyDirectorate','Navy;Directorate').replace('IowaThe','Iowa;The').replace('LausanneEawag','Lausanne;Eawag')
    temp = temp.replace('UTECHarvard','UTEC;Harvard').replace('UniversityMemorial','University;Memorial')
    temp = temp.replace('pción—UdeCBiofor', 'pción;UdeC;Biofor').replace('DéveloppementUniversité','Développement;Université')
    temp = temp.replace('Toulouse\u002DCNRS', 'Toulouse;CNRS').replace('LondonConsorcio','London;Consorcio')
    temp = temp.replace('MolinaInstitut','Molina;Institute').replace('Toulouse\u002DCNRS–IRD–OMP–CNESSENAMHI','Toulouse;CNRS–IRD–OMP–CNES;SENAMHI')
    temp = temp.replace('Toulouse\u002DCNRS–IRD–OMP\u002DCNESLAASSubdirección', 'Toulouse;CNRS–IRD–OMP–CNES;LAAS;Subdirección')
    temp = temp.replace('BlancUniversité', 'Blanc;Université').replace('NorteCentro','Norte;Centro').replace('Toulouse - CNRS','Toulouse;CNRS')
    temp = temp.replace('Toulouse\u2013CNRS', 'Toulouse;CNRS').replace('veloppementUniversi','veloppement;Universi').replace('sferaCNRS','sfera;CNRS').replace('CNESLAASSubdirecci','CNES;LAAS;Subdirecci').replace('ESMOI)Universit','ESMOI);Universit').replace('Toulouse - CNRS','Toulouse;CNRS').replace('MarUniversit','Mar;Universit').replace('CNESUniversidad','CNES;Universidad').replace('BlancUniversi','Blanc;Universi').replace('AgroUniversi','Agro;Universi').replace('CNESBordeaux','CNES;Bordeaux').replace('CNESCNRS','CNES;CNRS').replace('ZA)Facultad','ZA);Facultad').replace('SabatierCNRS','Sabatier;CNRS').replace('IRD/Universit','IRD;Universit').replace('NESCNRS/IRD/Univer','NES;CNRS/IRD;Univer').replace('\u2013CNESSENAMHI','\u2013CNES;SENAMHI').replace('Toulouse\u002DCNRS', 'Toulouse;CNRS').replace('Toulouse\u2013CNRS', 'Toulouse;CNRS')
    temp = temp.replace('HospitalMaastricht','Hospital;Maastricht').replace('Concepción\u2014UdeC','Concepción;UdeC')
    temp = temp.replace('UTECArtificio','UTEC;Artificio').replace('UTECDepartamento','UTEC;Departamento').replace('UNIRED','UNI;RED')
    temp = temp.replace('UniversityBoston','University;Boston').replace('UNIBlue','UNI;Blue').replace('PauloRIDC','Paulo;RIDC')
    temp = temp.replace('HospitalMaastricht', 'Hospital;Maastricht').replace('UTECMaintenance','UTEC;Maintenance')
    temp = temp.replace('DamePacific','Dame;Pacific').replace('PabloIBM','Pablo;IBM')
    temp = temp.split(';')
    return temp

def homogenizar_texto(texto, eliminar_espacios_extra=True, lowercase=True):
    if not texto:
        return ""
    if lowercase:
        texto = texto.lower()
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    reemplazos = {
        'ñ': 'n',
        'ü': 'u',
        'ç': 'c',
        'ß': 'ss',
    }
    for original, reemplazo in reemplazos.items():
        texto = texto.replace(original, reemplazo)
    texto = texto.replace('→','').replace('…','')
    texto = texto[:-1] if texto[-1] == ',' else texto
    if eliminar_espacios_extra:
        texto = re.sub(r'\s+', ' ', texto).strip()
    return texto

def clean_degree(texto):
    if texto is None:
        return None
    texto = texto.replace('\u2192', '')
    texto = texto.replace('\u2026', '').replace(' Í', 'í')
    for simbolo in ['→', '➔', '➡', '←', '↓', '↑', '…', '–', '—']:
        texto = texto.replace(simbolo, '')
    texto = texto.strip()
    texto = texto.rstrip(',').rstrip()
    return texto

def add_college(education_history, grade_list=[]):
    for info_grade in education_history:
        sm_txt = copy(info_grade['titulo'])
        hom_txt = homogenizar_texto(sm_txt)
        for g in grade_list:
            if g in hom_txt:
                st = clean_degree(info_grade['titulo'])
                su = clean_degree(info_grade['universidad'])
                return st, su
    return '', ''

def collect_degrees(prof_info):
    phd_tags_list = ['doctor', 'doctora', 'doctorado', 'phd']
    msc_tags_list = ['master', 'maestria', 'msc', 'magister']
    lic_tags_list = ['licenciada', 'titulo', 'titulado']
    bsc_tags_list = ['bachiller', 'bsc']
    summ = {
        'doctorado':'','universidad_phd':'',
        'maestria':'','universidad_msc':'',
        'licenciatura':'','universidad_lic':'',
        'bachiller':'','universidad_bsc':''
        }
    summ['name'] = prof_info['name']
    summ['doctorado'], summ['universidad_phd'] = add_college(prof_info['education'], phd_tags_list)
    summ['maestria'], summ['universidad_msc'] = add_college(prof_info['education'], msc_tags_list)
    summ['licenciatura'], summ['universidad_lic'] = add_college(prof_info['education'], lic_tags_list)
    summ['bachiller'], summ['universidad_bsc'] = add_college(prof_info['education'], bsc_tags_list)
    return summ


profile = pd.DataFrame([{
    'name': prof_info['name'],
    'email': prof_info['email'],
    'dept': prof_info['dept'],
    'photo_url': prof_info['photo_url'],
    'profile_url': prof_info['profile_url'],
    'orcid': prof_info['orcid'],
    'scholar_url': prof_info['scholar_url'],
    'scopus_url': prof_info['scopus_url'],
    'linkedin_url': prof_info['linkedin_url'],
    'bio': prof_info['bio'],
    'h-index': prof_info['h-index'],
    'citations': prof_info['citations'],
    'concytec_url': prof_info['concytec_url'],
    "groups": prof_info["groups"],
    "areas": prof_info["areas"],
    "fingerprints": [{
        'campo': campo_info['campo'],
        'temas': [{
            'nombre': tema_info['nombre'],
            'puntaje': float(tema_info['puntaje']),
        }
            for tema_info in campo_info['temas']
        ],
    }
        for campo_info in prof_info["fingerprints"]
    ],
    'collaborators': [{
        'colaborador':j['colaborador'],
        'research_center':[q for p in j['research_center'] for q in split_orgs(p)],
        'puesto':j['puesto'],
        'num_publicaciones':int(j['num_publicaciones'].split(' ')[0])
    }
        for j in prof_info['collaborators']
    ],
    "internal_orgs": prof_info['internal_orgs'],
    "external_orgs": prof_info['external_orgs'],
    
    
} | collect_degrees(prof_info)
    for prof_info in info_professors
])


profile['profile_url'] = profile['profile_url'].apply(lambda x: limpiar_texto_url(x))
profile['email'] = profile['email'].apply(lambda x: limpiar_texto_url(x))
profile['dept'] = profile['dept'].apply(lambda x: limpiar_texto_url(x))
profile['bio'] = profile['bio'].apply(lambda x: limpiar_texto_url(x))
profile = profile.replace({np.nan: None})

with open('data/transformed/profile.json', 'w', encoding='utf-8') as f: json.dump(profile.to_dict(orient='records'),f, indent=4, ensure_ascii=False)
# with open('data/transformed/profile.json', 'r', encoding='utf-8') as f: profile = json.load(f)
