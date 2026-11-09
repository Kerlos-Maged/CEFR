# Featured heritage reference content

The public archive includes five historic site profiles and one individually identified icon record in `lib/content/featured-heritage.ts`.
They remain separate from church-submitted records and the publication workflow. The interface
labels them as historic references and says explicitly that their presence does not imply
partnership or church approval. Each record uses a reserved, permanent public ID and resolves
directly to its bilingual object page, including when Supabase is configured.

## Research sources

- The Egyptian Ministry of Tourism and Antiquities, [The Hanging Church (English)](https://egymonuments.gov.eg/monuments/the-hanging-church/) and [The Hanging Church (Arabic)](https://mota.gov.eg/ar/%D8%A7%D9%84%D8%A2%D8%AB%D8%A7%D8%B1-%D9%88%D8%A7%D9%84%D9%85%D8%AA%D8%A7%D8%AD%D9%81/%D8%A7%D9%84%D9%85%D8%AC%D9%84%D8%B3-%D8%A7%D9%84%D8%A3%D8%B9%D9%84%D9%89-%D9%84%D9%84%D8%A2%D8%AB%D8%A7%D8%B1/%D8%AF%D9%84%D9%8A%D9%84-%D8%A7%D9%84%D9%85%D9%88%D8%A7%D9%82%D8%B9-%D8%A7%D9%84%D8%A3%D8%AB%D8%B1%D9%8A%D8%A9-%D8%A7%D9%84%D9%85%D9%81%D8%AA%D9%88%D8%AD%D8%A9-%D9%84%D9%84%D8%B2%D9%8A%D8%A7%D8%B1%D8%A9-%D8%AC%D8%AF%D9%8A%D8%AF/%D8%A7%D9%84%D9%83%D9%86%D9%8A%D8%B3%D8%A9-%D8%A7%D9%84%D9%85%D8%B9%D9%84%D9%82%D8%A9/). Their descriptions differ on some architectural details; the public record avoids disputed counts. Dates distinguish the broad 4th–5th-century range in the Arabic monument listing from a separate Ministry account that places construction near the end of the 4th century. The Ministry dates the marble pulpit to the 11th century and the oldest icons to the 15th century, with most others from the late 18th century.
- The Egyptian Ministry of Tourism and Antiquities, [Church of Saint Sergius and Bacchus (Abu Serga)](https://egymonuments.gov.eg/en/monuments/church-of-saint-sergius-and-bacchus/). The Ministry explicitly records disagreement over the church's date: late 4th/early 5th century according to some scholars, 17th century according to others. The page describes a basilican church and cave below the sanctuary.
- The Egyptian Ministry of Tourism and Antiquities, [The Journey of the Holy Family](https://egymonuments.gov.eg/news/the-journey-of-the-holy-family/). Used for route associations at Abu Serga, the Hanging Church, and the Virgin Mary Church in Maadi. These associations are described as religious tradition, not treated as archaeological proof of a building date.
- The Egyptian Ministry of Tourism and Antiquities, [The Red Monastery](https://egymonuments.gov.eg/monuments/the-red-monastery/). Used for the Sohag location, building materials, church plan and painted sanctuary, and the Ministry's attributed foundation account.
- The Egyptian Ministry of Tourism and Antiquities, [Monastery of the Syrians](https://egymonuments.gov.eg/monuments/monastery-of-the-syrians/), and the University of Warsaw / University of Amsterdam [Deir al-Surian research project](https://www.archeologia.uw.edu.pl/en/deir-al-surian-monastic-church/). Used for the monastery, Church of the Virgin Mary, and documented later phases. The research project itself notes architectural changes over time.
- The Hanging Church icon nicknamed the Coptic Mona Lisa: a 2023 [academic study](https://ijmsac.journals.ekb.eg/article_304812_3cebe229efbb4c5f7e25d77c01c38ea9.pdf), an [Ahram Online photo feature](https://english.ahram.org.eg/NewsContentMulti/117459/Search.aspx), and the [Wikimedia Commons image file](https://commons.wikimedia.org/wiki/File:%D9%84%D9%88%D8%AD%D8%A9_%D8%A7%D9%84%D9%85%D9%88%D9%86%D8%A7%D9%84%D9%8A%D8%B2%D8%A7_%D8%A7%D9%84%D9%82%D8%A8%D8%B7%D9%8A%D8%A9.jpg) (Nan deko, CC BY-SA 3.0). The item's precise date is left undetermined: the Ministry's 15th–18th-century range describes the church's collection broadly, not this icon specifically.

## Image sources and reuse notes

The interface uses Commons media with file-page links beside each image:

- Hanging Church exterior: [Outside Hanging church.JPG](https://commons.wikimedia.org/wiki/File:Outside_Hanging_church.JPG), Hajar Karam (هاجر كرم), CC BY-SA 3.0.
- Abu Serga interior: [Church of Abu Serga-Cairo.JPG](https://commons.wikimedia.org/wiki/File:Church_of_Abu_Serga-Cairo.JPG), CC BY-SA 4.0, author Faris knight.
- Maadi church exterior: [MaadiVirginChurchEastSide.jpg](https://commons.wikimedia.org/wiki/File:MaadiVirginChurchEastSide.jpg), released to the public domain by author Roland Unger.
- Red Monastery sanctuary: [Red_Monastery_Sohag_Egypt_Sanctuary_North_apse.jpg](https://commons.wikimedia.org/wiki/File:Red_Monastery_Sohag_Egypt_Sanctuary_North_apse.jpg), Ctschroeder, CC BY-SA 4.0.
- Monastery of the Syrians: [Deir as Suriani.jpg](https://commons.wikimedia.org/wiki/File:Deir_as_Suriani.jpg), Lumen roma, CC BY 3.0 (also available under GFDL 1.2+).
- Coptic Mona Lisa icon: [لوحة الموناليزا القبطية.jpg](https://commons.wikimedia.org/wiki/File:%D9%84%D9%88%D8%AD%D8%A9_%D8%A7%D9%84%D9%85%D9%88%D9%86%D8%A7%D9%84%D9%8A%D8%B2%D8%A7_%D8%A7%D9%84%D9%82%D8%A8%D8%B7%D9%8A%D8%A9.jpg), Nan deko, CC BY-SA 3.0.

Images are loaded from Wikimedia Commons and are not copied into the repository. The hero uses the
Hanging Church exterior as the landing-page feature image; informative cards and records include
localized alt text and image credits. The header uses typography and a restrained geometric textile
border; the loader is a simple CSS ring without a pictogram.

## Editorial boundaries

Historic site records remain distinct from church-submitted records and do not imply partnership or
church approval. The Mona Lisa record identifies a specific named image and has its own permanent QR
record, but does not invent material, dimensions, conservation status, or an exact chronology. Church
profile pages include a QR linking to the profile and list related object records. The Red Monastery
and Deir al-Surian profiles are historical site references, not onboarded church partner pages.
