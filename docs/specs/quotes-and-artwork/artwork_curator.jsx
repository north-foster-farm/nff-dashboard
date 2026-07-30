import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ARTWORKS = [{"id":"met-11265","title":"The New Bonnet","date":"1876","medium":"Oil on academy board","credit_line":"Bequest of Collis P. Huntington, 1900","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT2783.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT2783.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11265","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Eastman Johnson","artist_lifespan":"1824–1906","artist_role":"American genre painter","artist_bio":"Maine-born painter and a co-founder of the Metropolitan Museum of Art. He summered on Nantucket from 1870 onward and made New England rural life a recurring subject — maple sugaring in Maine, cranberry harvesting and corn husking on Nantucket — depicting agricultural community with warmth and dignity."},{"id":"met-13313","title":"Evening in the Woods","date":"1876","medium":"Oil on canvas","credit_line":"Bequest of Henry H. Cook, 1905","image_full":"https://images.metmuseum.org/CRDImages/ad/original/APS2208.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/APS2208.jpg","object_url":"https://www.metmuseum.org/art/collection/search/13313","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Worthington Whittredge","artist_lifespan":"1820–1910","artist_role":"Hudson River School painter","artist_bio":"Hudson River School painter who, after a decade studying in Düsseldorf, returned to the U.S. and became one of the most respected American landscapists of his era. His forest interiors and Newport pastures balanced European technique with distinctly American subjects."},{"id":"met-10497","title":"View from Mount Holyoke, Northampton, Massachusetts, after a Thunderstorm—The Oxbow","date":"1836","medium":"Oil on canvas","credit_line":"Gift of Mrs. Russell Sage, 1908","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DP-12550-001.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DP-12550-001.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10497","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Thomas Cole","artist_lifespan":"1801–1848","artist_role":"Founder, Hudson River School","artist_bio":"English-born American painter who founded the Hudson River School, the first major American landscape movement. His grand views of the Catskills and the White Mountains romanticized the American wilderness at the moment it was being settled and cleared."},{"id":"met-849540","title":"Winter Morning","date":"1857–1907","medium":"Hand-colored lithograph","credit_line":"Bequest of Adele S. Colgate, 1962","image_full":"https://images.metmuseum.org/CRDImages/dp/original/DP-20763-001.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/dp/web-large/DP-20763-001.jpg","object_url":"https://www.metmuseum.org/art/collection/search/849540","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Currier & Ives","artist_lifespan":"1857–1907","artist_role":"American lithography firm","artist_bio":"New York-based lithography firm founded by Nathaniel Currier in 1835 and joined by James Merritt Ives in 1857. They produced thousands of inexpensive hand-colored prints — including dozens of iconic Durrie winter farm scenes — that put American rural imagery in homes across the country."},{"id":"met-10501","title":"View on the Catskill—Early Autumn","date":"1836–37","medium":"Oil on canvas","credit_line":"Gift in memory of Jonathan Sturges by his children, 1895","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT2639.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT2639.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10501","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Thomas Cole","artist_lifespan":"1801–1848","artist_role":"Founder, Hudson River School","artist_bio":"English-born American painter who founded the Hudson River School, the first major American landscape movement. His grand views of the Catskills and the White Mountains romanticized the American wilderness at the moment it was being settled and cleared."},{"id":"met-11145","title":"The Veteran in a New Field","date":"1865","medium":"Oil on canvas","credit_line":"Bequest of Miss Adelaide Milton de Groot (1876-1967), 1967","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DP102298.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DP102298.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11145","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Winslow Homer","artist_lifespan":"1836–1910","artist_role":"American painter","artist_bio":"Boston-born American realist who began as a Civil War illustrator before turning to painting. After 1883 he settled at Prouts Neck, Maine, where he produced many of his most famous marine works. His agrarian and rural scenes from the 1860s–70s — particularly The Veteran in a New Field — are among the defining American images of post-Civil War life."},{"id":"met-416138","title":"The Old Farm Gate","date":"1864","medium":"Hand-colored lithograph","credit_line":"Gift of A. S. Colgate, 1952","image_full":"https://images.metmuseum.org/CRDImages/dp/original/DP-39479-001.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/dp/web-large/DP-39479-001.jpg","object_url":"https://www.metmuseum.org/art/collection/search/416138","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Frances Flora Bond Palmer","artist_lifespan":"1812–1876","artist_role":"Lithographer for Currier & Ives","artist_bio":"English-born artist and one of the most prolific designers for Currier & Ives. She drew many of the firm's most beloved American landscapes and farm scenes, working at a time when professional women artists were extraordinarily rare."},{"id":"met-416140","title":"New England Scenery","date":"1866","medium":"Hand-colored lithograph","credit_line":"Gift of A. S. Colgate, 1952","image_full":"https://images.metmuseum.org/CRDImages/dp/original/DP-39482-001.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/dp/web-large/DP-39482-001.jpg","object_url":"https://www.metmuseum.org/art/collection/search/416140","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Frances Flora Bond Palmer","artist_lifespan":"1812–1876","artist_role":"Lithographer for Currier & Ives","artist_bio":"English-born artist and one of the most prolific designers for Currier & Ives. She drew many of the firm's most beloved American landscapes and farm scenes, working at a time when professional women artists were extraordinarily rare."},{"id":"met-11279","title":"Spring","date":"1885–86","medium":"Oil on canvas","credit_line":"Gift of George I. Seney, 1887","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap87.8.9.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap87.8.9.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11279","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"H. Bolton Jones","artist_lifespan":"1848–1927","artist_role":"American landscape painter","artist_bio":"Baltimore-born American landscape painter who studied in France and became known for pastoral scenes of farms, fields, and old stone walls — particularly springtime images that captured the soft, awakening light of the rural Northeast."},{"id":"met-17054","title":"Sheep","date":"1878","medium":"Dark graphite and white gouache on vat-dyed wove paper","credit_line":"Bequest of Molly Flagg Knudtsen, 2001","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT5027.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT5027.jpg","object_url":"https://www.metmuseum.org/art/collection/search/17054","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Winslow Homer","artist_lifespan":"1836–1910","artist_role":"American painter","artist_bio":"Boston-born American realist who began as a Civil War illustrator before turning to painting. After 1883 he settled at Prouts Neck, Maine, where he produced many of his most famous marine works. His agrarian and rural scenes from the 1860s–70s — particularly The Veteran in a New Field — are among the defining American images of post-Civil War life."},{"id":"met-12831","title":"Dawn—Early Spring","date":"1894","medium":"Oil on wood","credit_line":"Gift of Mrs. George Langdon Jewett, 1917","image_full":"https://images.metmuseum.org/CRDImages/ad/original/APS2222.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/APS2222.jpg","object_url":"https://www.metmuseum.org/art/collection/search/12831","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Dwight William Tryon","artist_lifespan":"1849–1925","artist_role":"American Tonalist painter","artist_bio":"American landscape painter associated with the Tonalist movement. His subdued, atmospheric New England scenes — early springs, autumn evenings — sought to capture mood rather than literal description, and made him one of the most respected American landscapists of the late 19th century."},{"id":"met-415910","title":"The Harvest Moon","date":"1857–71","medium":"Hand-colored lithograph","credit_line":"Gift of A. S. Colgate, 1951","image_full":"https://images.metmuseum.org/CRDImages/dp/original/DP-39487-001.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/dp/web-large/DP-39487-001.jpg","object_url":"https://www.metmuseum.org/art/collection/search/415910","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Currier & Ives","artist_lifespan":"1857–1907","artist_role":"American lithography firm","artist_bio":"New York-based lithography firm founded by Nathaniel Currier in 1835 and joined by James Merritt Ives in 1857. They produced thousands of inexpensive hand-colored prints — including dozens of iconic Durrie winter farm scenes — that put American rural imagery in homes across the country."},{"id":"met-10793","title":"Landscape—Scene from \"Thanatopsis\"","date":"1850","medium":"Oil on canvas","credit_line":"Gift of J. Pierpont Morgan, 1911","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT1539.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT1539.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10793","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Asher Brown Durand","artist_lifespan":"1796–1886","artist_role":"Hudson River School painter","artist_bio":"American landscape painter and founding member of the Hudson River School alongside Thomas Cole. His meticulous, spiritually inflected paintings of forests and pastoral valleys, and his Letters on Landscape Painting, helped establish landscape as a serious American art form."},{"id":"met-11053","title":"Newburyport Meadows","date":"ca. 1876–81","medium":"Oil on canvas","credit_line":"Purchase, Mrs. Samuel P. Reed Gift, Morris K. Jesup Fund, Maria DeWitt Jesup Fund, John Osgood and Elizabeth Amis Cameron Blanchard Memorial Fund and Gifts of Robert E. Tod and William Gedney Bunce, by exchange, 1985","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT2050.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT2050.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11053","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Martin Johnson Heade","artist_lifespan":"1819–1904","artist_role":"American painter","artist_bio":"American painter known for atmospheric salt marshes, coastal views, and luminous still lifes of orchids and hummingbirds. His New England marsh paintings — quiet, low-horizoned, infused with weather — are among the most distinctive American landscapes of the 19th century."},{"id":"met-11311","title":"Lake George","date":"1869","medium":"Oil on canvas","credit_line":"Bequest of Maria DeWitt Jesup, from the collection of her husband, Morris K. Jesup, 1914","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT84.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT84.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11311","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"John Frederick Kensett","artist_lifespan":"1816–1872","artist_role":"Hudson River School painter","artist_bio":"Connecticut-born Hudson River School painter celebrated for his serene, light-filled landscapes of the Northeast — Lake George, Newport, the White Mountains. His Mount Washington from the Valley of Conway was so popular it was reproduced for thousands of subscribers, making the White Mountains a tourist destination."},{"id":"met-10805","title":"Red School House (Country Scene)","date":"1858","medium":"Oil on canvas","credit_line":"Bequest of Peter H. B. Frelinghuysen, 2011","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DP277399.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DP277399.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10805","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"George Henry Durrie","artist_lifespan":"1820–1863","artist_role":"American painter","artist_bio":"Hartford, Connecticut native who made snowy New England farm scenes his life's subject. Currier & Ives published lithographs of his paintings widely, fixing his cozy winter farmhouses in the American imagination as the visual shorthand for old New England country life. Died at 42."},{"id":"met-851638","title":"Summer Woodlands","date":"ca. 1870s","medium":"Oil on paper mounted to board","credit_line":"The Morse Family Foundation Fund, 2021","image_full":"https://images.metmuseum.org/CRDImages/ad/original/After Conservation_Julie Hart Beers.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/After Conservation_Julie Hart Beers.jpg","object_url":"https://www.metmuseum.org/art/collection/search/851638","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Julie Hart Beers","artist_lifespan":"1835–1913","artist_role":"Hudson River School painter","artist_bio":"American landscape painter and one of the few women associated with the Hudson River School. Sister of fellow painters William and James Hart, she ran her own studio in New York and exhibited regularly, focusing on intimate woodland scenes of the Hudson Valley and New England."},{"id":"met-11323","title":"Summer Day on Conesus Lake","date":"1870","medium":"Oil on canvas","credit_line":"Bequest of Collis P. Huntington, 1900","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap25.110.5.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap25.110.5.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11323","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"John Frederick Kensett","artist_lifespan":"1816–1872","artist_role":"Hudson River School painter","artist_bio":"Connecticut-born Hudson River School painter celebrated for his serene, light-filled landscapes of the Northeast — Lake George, Newport, the White Mountains. His Mount Washington from the Valley of Conway was so popular it was reproduced for thousands of subscribers, making the White Mountains a tourist destination."},{"id":"met-11326","title":"Sunset Sky","date":"1872","medium":"Oil on canvas","credit_line":"Gift of Thomas Kensett, 1874","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap74.30.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap74.30.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11326","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"John Frederick Kensett","artist_lifespan":"1816–1872","artist_role":"Hudson River School painter","artist_bio":"Connecticut-born Hudson River School painter celebrated for his serene, light-filled landscapes of the Northeast — Lake George, Newport, the White Mountains. His Mount Washington from the Valley of Conway was so popular it was reproduced for thousands of subscribers, making the White Mountains a tourist destination."},{"id":"met-10946","title":"A Gorge in the Mountains (Kauterskill Clove)","date":"1862","medium":"Oil on canvas","credit_line":"Bequest of Maria DeWitt Jesup, from the collection of her husband, Morris K. Jesup, 1914","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT81.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT81.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10946","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Sanford Robinson Gifford","artist_lifespan":"1823–1880","artist_role":"Hudson River School painter","artist_bio":"Hudson River School painter and a leading figure in American luminism. His Catskill and Adirondack landscapes are bathed in a soft, almost theatrical golden light, capturing a particular quality of American atmosphere that critics called 'air-painting.'"},{"id":"met-380483","title":"Winter Morning in the Country","date":"1873","medium":"Hand-colored lithograph","credit_line":"Bequest of Adele S. Colgate, 1962","image_full":"https://images.metmuseum.org/CRDImages/dp/original/DT9292.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/dp/web-large/DT9292.jpg","object_url":"https://www.metmuseum.org/art/collection/search/380483","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Currier & Ives","artist_lifespan":"1857–1907","artist_role":"American lithography firm","artist_bio":"New York-based lithography firm founded by Nathaniel Currier in 1835 and joined by James Merritt Ives in 1857. They produced thousands of inexpensive hand-colored prints — including dozens of iconic Durrie winter farm scenes — that put American rural imagery in homes across the country."},{"id":"met-14426","title":"Hackensack Meadows","date":"1890","medium":"Watercolor, gouache, and graphite on off-white wove paper","credit_line":"Gift of Mrs. John C. Newington, 1992","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap1992.97.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap1992.97.jpg","object_url":"https://www.metmuseum.org/art/collection/search/14426","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Jasper Francis Cropsey","artist_lifespan":"1823–1900","artist_role":"Hudson River School painter","artist_bio":"Hudson River School painter who specialized in dazzling autumn landscapes. His flaming red and gold New England and New York scenes earned him the nickname 'America's painter of autumn,' and his paintings introduced European audiences to the spectacle of American fall foliage."},{"id":"met-10586","title":"The Valley of Wyoming","date":"1865","medium":"Oil on canvas","credit_line":"Gift of Mrs. John C. Newington, 1966","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT4598.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT4598.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10586","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Jasper Francis Cropsey","artist_lifespan":"1823–1900","artist_role":"Hudson River School painter","artist_bio":"Hudson River School painter who specialized in dazzling autumn landscapes. His flaming red and gold New England and New York scenes earned him the nickname 'America's painter of autumn,' and his paintings introduced European audiences to the spectacle of American fall foliage."},{"id":"met-10589","title":"Wyoming Valley, Pennsylvania","date":"1864","medium":"Oil on canvas","credit_line":"Bequest of Collis P. Huntington, 1900","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap25.110.63.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap25.110.63.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10589","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Jasper Francis Cropsey","artist_lifespan":"1823–1900","artist_role":"Hudson River School painter","artist_bio":"Hudson River School painter who specialized in dazzling autumn landscapes. His flaming red and gold New England and New York scenes earned him the nickname 'America's painter of autumn,' and his paintings introduced European audiences to the spectacle of American fall foliage."},{"id":"met-11234","title":"Spring Blossoms, Montclair, New Jersey","date":"ca. 1891","medium":"Oil and crayon or charcoal on canvas","credit_line":"Gift of George A. Hearn, in memory of Arthur Hoppock Hearn, 1911","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT98.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT98.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11234","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"George Inness","artist_lifespan":"1825–1894","artist_role":"American landscape painter","artist_bio":"Often called the father of American landscape painting. Influenced first by the Hudson River School, then by the French Barbizon painters, and finally by the spiritualism of Emanuel Swedenborg, he developed an atmospheric, emotionally charged style. His late works are misty, golden, almost devotional."},{"id":"met-11619","title":"Cider Making","date":"1840–41","medium":"Oil on canvas","credit_line":"Purchase, Bequest of Charles Allen Munn, by exchange, 1966","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT72.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT72.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11619","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"William Sidney Mount","artist_lifespan":"1807–1868","artist_role":"American genre painter","artist_bio":"Long Island-born painter who specialized in scenes of rural American life — farmhouses, cider making, dance halls, country gatherings. His sympathetic portraits of working farmers and farmhands are among the earliest serious American genre paintings."},{"id":"met-10214","title":"The Farm","date":"ca. 1880–90","medium":"Watercolor, gouache, and graphite on white wove paper","credit_line":"Gift of Mr. and Mrs. Stuart P. Feld, 1974","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap1974.358.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap1974.358.jpg","object_url":"https://www.metmuseum.org/art/collection/search/10214","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Alfred Thompson Bricher","artist_lifespan":"1837–1908","artist_role":"American painter","artist_bio":"American landscape and marine painter associated with the late Hudson River School and the luminist tradition. He painted New England coastal scenes, pastoral farms, and the rocky shorelines of Massachusetts and Maine."},{"id":"met-11623","title":"Long Island Farmhouses","date":"1862–63","medium":"Oil on canvas","credit_line":"Gift of Louise F. Wickham, in memory of her father, William H. Wickham, 1928","image_full":"https://images.metmuseum.org/CRDImages/ad/original/DT228021.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/DT228021.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11623","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"William Sidney Mount","artist_lifespan":"1807–1868","artist_role":"American genre painter","artist_bio":"Long Island-born painter who specialized in scenes of rural American life — farmhouses, cider making, dance halls, country gatherings. His sympathetic portraits of working farmers and farmhands are among the earliest serious American genre paintings."},{"id":"met-11123","title":"Harvest Scene","date":"ca. 1873","medium":"Oil on canvas","credit_line":"George A. Hearn Fund, 1909","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap09.26.6.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap09.26.6.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11123","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Winslow Homer","artist_lifespan":"1836–1910","artist_role":"American painter","artist_bio":"Boston-born American realist who began as a Civil War illustrator before turning to painting. After 1883 he settled at Prouts Neck, Maine, where he produced many of his most famous marine works. His agrarian and rural scenes from the 1860s–70s — particularly The Veteran in a New Field — are among the defining American images of post-Civil War life."},{"id":"met-773107","title":"The Farmer's Home -- Winter","date":"1863","medium":"Hand-colored lithograph","credit_line":"Bequest of Adele S. Colgate, 1962","image_full":"https://images.metmuseum.org/CRDImages/dp/original/DP-39480-001.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/dp/web-large/DP-39480-001.jpg","object_url":"https://www.metmuseum.org/art/collection/search/773107","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"George Henry Durrie","artist_lifespan":"1820–1863","artist_role":"American painter","artist_bio":"Hartford, Connecticut native who made snowy New England farm scenes his life's subject. Currier & Ives published lithographs of his paintings widely, fixing his cozy winter farmhouses in the American imagination as the visual shorthand for old New England country life. Died at 42."},{"id":"met-11259","title":"Corn Husking at Nantucket","date":"ca. 1875","medium":"Oil on canvas","credit_line":"Rogers Fund, 1907","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap07.68.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap07.68.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11259","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Eastman Johnson","artist_lifespan":"1824–1906","artist_role":"American genre painter","artist_bio":"Maine-born painter and a co-founder of the Metropolitan Museum of Art. He summered on Nantucket from 1870 onward and made New England rural life a recurring subject — maple sugaring in Maine, cranberry harvesting and corn husking on Nantucket — depicting agricultural community with warmth and dignity."},{"id":"met-459516","title":"Farm Scene","date":"second half 19th century","medium":"Watercolor","credit_line":"Robert Lehman Collection, 1975","image_full":"https://images.metmuseum.org/CRDImages/rl/original/DP-22055-001.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/rl/web-large/DP-22055-001.jpg","object_url":"https://www.metmuseum.org/art/collection/search/459516","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"met-11135","title":"Saddle Horse in Farm Yard","date":"ca. 1870–75","medium":"Oil on wood","credit_line":"Bequest of Miss Adelaide Milton de Groot (1876-1967), 1967","image_full":"https://images.metmuseum.org/CRDImages/ad/original/ap67.187.130.jpg","image_thumb":"https://images.metmuseum.org/CRDImages/ad/web-large/ap67.187.130.jpg","object_url":"https://www.metmuseum.org/art/collection/search/11135","source":"The Metropolitan Museum of Art","source_short":"Met","license":"Public Domain (CC0)","artist_name":"Winslow Homer","artist_lifespan":"1836–1910","artist_role":"American painter","artist_bio":"Boston-born American realist who began as a Civil War illustrator before turning to painting. After 1883 he settled at Prouts Neck, Maine, where he produced many of his most famous marine works. His agrarian and rural scenes from the 1860s–70s — particularly The Veteran in a New Field — are among the defining American images of post-Civil War life."},{"id":"nga-42490","title":"New England Farm in Winter","date":"1850 or after","medium":"oil on canvas","credit_line":"Gift of Edgar William and Bernice Chrysler Garbisch","image_full":"https://api.nga.gov/iiif/b69a8ea5-3a2a-4ad2-aae2-b9866594868e/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/b69a8ea5-3a2a-4ad2-aae2-b9866594868e/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/42490","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-42496","title":"Mahantango Valley Farm","date":"late 19th century","medium":"oil on window shade","credit_line":"Gift of Edgar William and Bernice Chrysler Garbisch","image_full":"https://api.nga.gov/iiif/02f53d1f-074a-4c0e-8765-cc1801a08101/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/02f53d1f-074a-4c0e-8765-cc1801a08101/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/42496","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-42497","title":"Farmhouse in Mahantango Valley","date":"late 19th century","medium":"oil on canvas","credit_line":"Gift of Edgar William and Bernice Chrysler Garbisch","image_full":"https://api.nga.gov/iiif/b1ce4b8d-bb10-4989-a8a5-cc5c27e359b3/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/b1ce4b8d-bb10-4989-a8a5-cc5c27e359b3/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/42497","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-43443","title":"New England Village","date":"early 19th century","medium":"oil on wood","credit_line":"Gift of Edgar William and Bernice Chrysler Garbisch","image_full":"https://api.nga.gov/iiif/98dd85ed-73a4-4251-9a3c-ff6bee9094a3/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/98dd85ed-73a4-4251-9a3c-ff6bee9094a3/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/43443","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-148220","title":"Farmer's Nooning","date":"c. 1840","medium":"lithograph in black","credit_line":"Reba and Dave Williams Collection, Gift of Reba and Dave Williams","image_full":"https://api.nga.gov/iiif/16bbcde0-7af2-42be-8958-4624b453e5b7/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/16bbcde0-7af2-42be-8958-4624b453e5b7/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/148220","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-59886","title":"Bucks County Farm Outside Doylestown, Pennsylvania","date":"c. 1890","medium":"oil on canvas","credit_line":"Gift of Edgar William and Bernice Chrysler Garbisch","image_full":"https://api.nga.gov/iiif/a0e57e06-45d6-4e92-826d-e15ddd0ee968/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/a0e57e06-45d6-4e92-826d-e15ddd0ee968/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/59886","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-183351","title":"Herd of Cattle","date":"19th century","medium":"lithograph in black on wove paper","credit_line":"Corcoran Collection (Gift of J. William Middendorf, II)","image_full":"https://api.nga.gov/iiif/35c99779-e7b0-4970-81a8-69b7c9beb61f/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/35c99779-e7b0-4970-81a8-69b7c9beb61f/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/183351","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-148377","title":"Moonlit Stroll in Winter","date":"c. 1880s","medium":"etching","credit_line":"Reba and Dave Williams Collection, Gift of Reba and Dave Williams","image_full":"https://api.nga.gov/iiif/86e30de5-79ea-4005-be74-1cd6d0f35d1e/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/86e30de5-79ea-4005-be74-1cd6d0f35d1e/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/148377","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"American 19th Century (anonymous)","artist_lifespan":"19th century","artist_role":"Folk / self-taught painter","artist_bio":"An unidentified American painter, often self-taught, working in the folk tradition. The National Gallery's collection of anonymous 19th-century farm paintings — gifted by Edgar and Bernice Garbisch — represents some of the most evocative vernacular art of agrarian America."},{"id":"nga-169927","title":"The Jonathan Baker Farm","date":"1924","medium":"etching in black on wove paper","credit_line":"Corcoran Collection (Gift of Mrs. Childe Hassam)","image_full":"https://api.nga.gov/iiif/bbc2bc89-53ac-4529-8274-0e799b9a3773/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/bbc2bc89-53ac-4529-8274-0e799b9a3773/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/169927","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"Childe Hassam","artist_lifespan":"1859–1935","artist_role":"American Impressionist","artist_bio":"One of the foremost American Impressionists. Best known for his urban scenes of New York and Boston, but he also produced an extensive body of work depicting New England villages, old colonial houses, and the working farms of Long Island and Connecticut."},{"id":"nga-183565","title":"The Old Mulford Farm","date":"1929","medium":"etching in black on wove paper","credit_line":"Corcoran Collection (Gift of Mrs. Childe Hassam)","image_full":"https://api.nga.gov/iiif/577a7f6f-e2ef-4bc6-b3f9-a83588948f94/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/577a7f6f-e2ef-4bc6-b3f9-a83588948f94/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/183565","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"Childe Hassam","artist_lifespan":"1859–1935","artist_role":"American Impressionist","artist_bio":"One of the foremost American Impressionists. Best known for his urban scenes of New York and Boston, but he also produced an extensive body of work depicting New England villages, old colonial houses, and the working farms of Long Island and Connecticut."},{"id":"nga-50257","title":"Winter Harmony","date":"c. 1890/1900","medium":"oil on canvas","credit_line":"Gift of the Avalon Foundation","image_full":"https://api.nga.gov/iiif/24f75bef-6596-4eac-8470-719b2f9876ec/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/24f75bef-6596-4eac-8470-719b2f9876ec/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/50257","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"John Henry Twachtman","artist_lifespan":"1853–1902","artist_role":"American Impressionist","artist_bio":"Cincinnati-born American Impressionist who, after studying in Munich and Paris, settled in Greenwich, Connecticut. His muted, intimate winter landscapes of his Connecticut farm — particularly Winter Harmony — are among the most personal and atmospheric American paintings of the 1890s."},{"id":"nga-55845","title":"Midsummer Twilight","date":"c. 1890","medium":"oil on canvas","credit_line":"Gift of Admiral Neill Phillips in memory of Grace Hendrick Phillips","image_full":"https://api.nga.gov/iiif/7d6db742-9e1b-46b6-a05d-dcd7039a21e4/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/7d6db742-9e1b-46b6-a05d-dcd7039a21e4/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/55845","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"Willard Leroy Metcalf","artist_lifespan":"1858–1925","artist_role":"American Impressionist","artist_bio":"Massachusetts-born American Impressionist and member of 'The Ten,' a group of artists who broke from the National Academy. He became known for his sensitive, season-specific New England landscapes — the dry brown of late autumn, the silvery green of summer twilight."},{"id":"nga-46474","title":"Autumn - On the Hudson River","date":"1860","medium":"oil on canvas","credit_line":"Gift of the Avalon Foundation","image_full":"https://api.nga.gov/iiif/0253c293-4cc1-4131-89a9-f2c997aebba0/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/0253c293-4cc1-4131-89a9-f2c997aebba0/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/46474","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"Jasper Francis Cropsey","artist_lifespan":"1823–1900","artist_role":"Hudson River School painter","artist_bio":"Hudson River School painter who specialized in dazzling autumn landscapes. His flaming red and gold New England and New York scenes earned him the nickname 'America's painter of autumn,' and his paintings introduced European audiences to the spectacle of American fall foliage."},{"id":"nga-89675","title":"Winter in the Country","date":"c. 1858","medium":"oil on canvas","credit_line":"Collection of Mr. and Mrs. Paul Mellon","image_full":"https://api.nga.gov/iiif/a6a9b39d-661b-4420-9c1e-00adf4d9e8e8/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/a6a9b39d-661b-4420-9c1e-00adf4d9e8e8/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/89675","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"George Henry Durrie","artist_lifespan":"1820–1863","artist_role":"American painter","artist_bio":"Hartford, Connecticut native who made snowy New England farm scenes his life's subject. Currier & Ives published lithographs of his paintings widely, fixing his cozy winter farmhouses in the American imagination as the visual shorthand for old New England country life. Died at 42."},{"id":"nga-109732","title":"Winter in the Country","date":"c. 1859","medium":"oil on canvas","credit_line":"Avalon Fund","image_full":"https://api.nga.gov/iiif/458896db-3993-40ff-a3ad-c67106243ed9/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/458896db-3993-40ff-a3ad-c67106243ed9/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/109732","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"George Henry Durrie","artist_lifespan":"1820–1863","artist_role":"American painter","artist_bio":"Hartford, Connecticut native who made snowy New England farm scenes his life's subject. Currier & Ives published lithographs of his paintings widely, fixing his cozy winter farmhouses in the American imagination as the visual shorthand for old New England country life. Died at 42."},{"id":"nga-66576","title":"The Farm-Yard in Winter","date":"1861","medium":"hand-colored lithograph, with touches of gum arabic, on wove paper","credit_line":"Collection of Mr. and Mrs. Paul Mellon","image_full":"https://api.nga.gov/iiif/27a850aa-69df-4a3f-b387-df57ff4773dd/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/27a850aa-69df-4a3f-b387-df57ff4773dd/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/66576","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"George Henry Durrie","artist_lifespan":"1820–1863","artist_role":"American painter","artist_bio":"Hartford, Connecticut native who made snowy New England farm scenes his life's subject. Currier & Ives published lithographs of his paintings widely, fixing his cozy winter farmhouses in the American imagination as the visual shorthand for old New England country life. Died at 42."},{"id":"nga-66577","title":"Home to Thanksgiving","date":"1867","medium":"hand-colored lithograph on wove paper","credit_line":"Collection of Mr. and Mrs. Paul Mellon","image_full":"https://api.nga.gov/iiif/d5316b31-27bf-4115-9dfe-80c187f8a1e5/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/d5316b31-27bf-4115-9dfe-80c187f8a1e5/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/66577","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"George Henry Durrie","artist_lifespan":"1820–1863","artist_role":"American painter","artist_bio":"Hartford, Connecticut native who made snowy New England farm scenes his life's subject. Currier & Ives published lithographs of his paintings widely, fixing his cozy winter farmhouses in the American imagination as the visual shorthand for old New England country life. Died at 42."},{"id":"nga-166502","title":"Trout Brook in the Catskills","date":"1875","medium":"oil on canvas","credit_line":"Corcoran Collection (Museum Purchase, Gallery Fund)","image_full":"https://api.nga.gov/iiif/d72d916c-74df-4bc4-9b86-97b65b158042/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/d72d916c-74df-4bc4-9b86-97b65b158042/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/166502","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"Worthington Whittredge","artist_lifespan":"1820–1910","artist_role":"Hudson River School painter","artist_bio":"Hudson River School painter who, after a decade studying in Düsseldorf, returned to the U.S. and became one of the most respected American landscapists of his era. His forest interiors and Newport pastures balanced European technique with distinctly American subjects."},{"id":"nga-42389","title":"Beacon Rock, Newport Harbor","date":"1857","medium":"oil on canvas","credit_line":"Gift of Frederick Sturges, Jr.","image_full":"https://api.nga.gov/iiif/c31769b8-f5f8-41bd-b204-1e838690c219/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/c31769b8-f5f8-41bd-b204-1e838690c219/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/42389","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"John Frederick Kensett","artist_lifespan":"1816–1872","artist_role":"Hudson River School painter","artist_bio":"Connecticut-born Hudson River School painter celebrated for his serene, light-filled landscapes of the Northeast — Lake George, Newport, the White Mountains. His Mount Washington from the Valley of Conway was so popular it was reproduced for thousands of subscribers, making the White Mountains a tourist destination."},{"id":"nga-178026","title":"View on the Genesee near Mount Morris","date":"1857","medium":"oil on canvas","credit_line":"Corcoran Collection (Museum Purchase, Gallery Fund)","image_full":"https://api.nga.gov/iiif/fbeae8d8-16ff-4796-b7df-0d4474f1fbba/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/fbeae8d8-16ff-4796-b7df-0d4474f1fbba/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/178026","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"John Frederick Kensett","artist_lifespan":"1816–1872","artist_role":"Hudson River School painter","artist_bio":"Connecticut-born Hudson River School painter celebrated for his serene, light-filled landscapes of the Northeast — Lake George, Newport, the White Mountains. His Mount Washington from the Valley of Conway was so popular it was reproduced for thousands of subscribers, making the White Mountains a tourist destination."},{"id":"nga-166430","title":"Cottage Scenery","date":"1845","medium":"oil on canvas","credit_line":"Corcoran Collection (Museum Purchase, Gallery Fund and Gifts of Charles C. Glover,  Jr., Orme Wilson, and Mr. and Mrs. Lansdell K. Christie)","image_full":"https://api.nga.gov/iiif/cba69cdf-4503-4439-9be3-93706a0f27db/full/full/0/default.jpg","image_thumb":"https://api.nga.gov/iiif/cba69cdf-4503-4439-9be3-93706a0f27db/full/!200,200/0/default.jpg","object_url":"https://www.nga.gov/artworks/166430","source":"National Gallery of Art, Washington","source_short":"NGA","license":"Public Domain (CC0)","artist_name":"George Caleb Bingham","artist_lifespan":"1811–1879","artist_role":"American genre painter","artist_bio":"Missouri-based painter best known for scenes of Mississippi River life and frontier American politics. His images of flatboatmen, county elections, and rural cottages are among the most memorable depictions of mid-19th-century American life west of the Appalachians."}];

const STORAGE_KEY = "nff_artwork_curation_v1";

export default function ArtworkCurator() {
  const [decisions, setDecisions] = useState({});
  const [index, setIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [storageReady, setStorageReady] = useState(false);

  // Load decisions from persistent storage on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await window.storage.get(STORAGE_KEY);
        if (mounted && stored && stored.value) {
          const parsed = JSON.parse(stored.value);
          setDecisions(parsed.decisions || {});
          if (typeof parsed.index === "number") {
            // resume at last unreviewed if possible
            const firstUnreviewed = ARTWORKS.findIndex(a => !(parsed.decisions || {})[a.id]);
            setIndex(firstUnreviewed >= 0 ? firstUnreviewed : Math.min(parsed.index, ARTWORKS.length - 1));
          }
        }
      } catch (e) {
        // No stored value yet — fresh start
      } finally {
        if (mounted) setStorageReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Persist decisions
  const persist = useCallback(async (newDecisions, newIndex) => {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify({
        decisions: newDecisions,
        index: newIndex,
        updated: new Date().toISOString(),
      }));
    } catch (e) {
      console.error("Storage write failed:", e);
    }
  }, []);

  const current = ARTWORKS[index];
  const total = ARTWORKS.length;
  const reviewed = Object.keys(decisions).length;
  const included = Object.values(decisions).filter(d => d === "include").length;
  const excluded = Object.values(decisions).filter(d => d === "exclude").length;
  const skipped = Object.values(decisions).filter(d => d === "skip").length;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [index]);

  const decide = (verdict) => {
    if (!current) return;
    const next = { ...decisions, [current.id]: verdict };
    setDecisions(next);
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      persist(next, nextIdx);
    } else {
      persist(next, index);
      setShowSummary(true);
    }
  };

  const goPrev = () => {
    if (index > 0) {
      const nextIdx = index - 1;
      setIndex(nextIdx);
      persist(decisions, nextIdx);
    }
  };

  const goNext = () => {
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      persist(decisions, nextIdx);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (showSummary) return;
      if (e.key === "y" || e.key === "Y" || e.key === "ArrowUp") { decide("include"); }
      else if (e.key === "n" || e.key === "N" || e.key === "ArrowDown") { decide("exclude"); }
      else if (e.key === "s" || e.key === "S") { decide("skip"); }
      else if (e.key === "ArrowLeft") { goPrev(); }
      else if (e.key === "ArrowRight") { goNext(); }
      else if (e.key === "i" || e.key === "I") { setShowInfo(p => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const exportData = () => {
    const includedList = ARTWORKS.filter(a => decisions[a.id] === "include").map(a => a.id);
    const excludedList = ARTWORKS.filter(a => decisions[a.id] === "exclude").map(a => a.id);
    const skippedList = ARTWORKS.filter(a => decisions[a.id] === "skip").map(a => a.id);

    const exportObj = {
      reviewed_at: new Date().toISOString(),
      total: ARTWORKS.length,
      included: includedList,
      excluded: excludedList,
      skipped: skippedList,
      decisions,
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nff_artwork_curation.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = async () => {
    if (!window.confirm("Reset all decisions? This cannot be undone.")) return;
    setDecisions({});
    setIndex(0);
    setShowSummary(false);
    try { await window.storage.delete(STORAGE_KEY); } catch (e) {}
  };

  if (!storageReady) {
    return (
      <div className="fixed inset-0 bg-stone-950 text-stone-400 flex items-center justify-center font-serif">
        loading…
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="fixed inset-0 bg-stone-950 text-stone-200 overflow-y-auto" style={{fontFamily: "Georgia, serif"}}>
        <div className="max-w-4xl mx-auto p-8">
          <div className="border-b border-amber-900/40 pb-6 mb-8">
            <div className="text-xs tracking-[0.3em] text-amber-700 uppercase mb-2">Curation Complete</div>
            <h1 className="text-4xl text-amber-50">Review Summary</h1>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-12">
            <Stat label="Included" value={included} accent="text-emerald-400" />
            <Stat label="Excluded" value={excluded} accent="text-rose-400" />
            <Stat label="Skipped" value={skipped} accent="text-amber-400" />
          </div>

          <div className="flex flex-wrap gap-3 mb-12">
            <button onClick={exportData} className="px-5 py-3 bg-amber-700 hover:bg-amber-600 text-stone-950 font-semibold tracking-wide transition">
              Export JSON
            </button>
            <button onClick={() => setShowSummary(false)} className="px-5 py-3 border border-stone-600 hover:border-stone-400 text-stone-200 transition">
              Continue Reviewing
            </button>
            <button onClick={reset} className="px-5 py-3 border border-rose-900 hover:border-rose-700 text-rose-300 transition">
              Reset All
            </button>
          </div>

          <h2 className="text-xl text-amber-100 mb-4 border-b border-stone-800 pb-2">Included ({included})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
            {ARTWORKS.filter(a => decisions[a.id] === "include").map(a => (
              <div key={a.id} className="text-xs border border-emerald-900/40 p-2">
                <img src={a.image_thumb} alt={a.title} className="w-full h-32 object-cover mb-2" />
                <div className="text-stone-200 truncate">{a.title}</div>
                <div className="text-stone-500 truncate">{a.artist_name}</div>
              </div>
            ))}
          </div>

          {excluded > 0 && (
            <>
              <h2 className="text-xl text-amber-100 mb-4 border-b border-stone-800 pb-2">Excluded ({excluded})</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10 opacity-50">
                {ARTWORKS.filter(a => decisions[a.id] === "exclude").map(a => (
                  <div key={a.id} className="text-xs border border-rose-900/40 p-2">
                    <img src={a.image_thumb} alt={a.title} className="w-full h-32 object-cover mb-2" />
                    <div className="text-stone-200 truncate">{a.title}</div>
                    <div className="text-stone-500 truncate">{a.artist_name}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 bg-stone-950 overflow-hidden" style={{fontFamily: "Georgia, serif"}}>
      {/* Background image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          {imageError ? (
            <div className="absolute inset-0 bg-stone-900 flex items-center justify-center text-stone-500">
              <div className="text-center">
                <div className="text-2xl mb-2">⚠</div>
                <div>Image failed to load</div>
                <div className="text-xs mt-2 text-stone-600">{current.image_full}</div>
              </div>
            </div>
          ) : (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-stone-900 flex items-center justify-center text-stone-500">
                  <div className="text-sm tracking-wide animate-pulse">loading high-res…</div>
                </div>
              )}
              <img
                src={current.image_full}
                alt={current.title}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Top bar — progress */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-stone-950/90 to-transparent p-5">
        <div className="flex items-center justify-between text-stone-300">
          <div className="text-xs tracking-[0.3em] uppercase">
            <span className="text-amber-500">NFF</span> · Artwork Curation
          </div>
          <div className="text-sm tabular-nums">
            <span className="text-amber-400">{index + 1}</span>
            <span className="text-stone-500"> / {total}</span>
            <span className="ml-4 text-emerald-400">+{included}</span>
            <span className="ml-2 text-rose-400">−{excluded}</span>
            {skipped > 0 && <span className="ml-2 text-amber-400">~{skipped}</span>}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-px bg-stone-800 relative">
          <div className="absolute left-0 top-0 h-px bg-amber-600 transition-all" style={{ width: `${(reviewed / total) * 100}%` }} />
          <div className="absolute left-0 top-0 h-px bg-amber-300/40 transition-all" style={{ width: `${((index) / total) * 100}%` }} />
        </div>
      </div>

      {/* Bottom info panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent pt-16 pb-6 px-6"
          >
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-xs tracking-[0.25em] text-amber-600 uppercase mb-2">Artwork</div>
                  <h2 className="text-2xl text-amber-50 leading-tight mb-1" style={{fontFamily: "'Playfair Display', Georgia, serif"}}>
                    {current.title}
                  </h2>
                  <div className="text-stone-400 text-sm italic mb-2">{current.date} · {current.medium}</div>
                  <div className="text-xs text-stone-500">
                    {current.source_short} · {current.license}
                  </div>
                </div>
                <div>
                  <div className="text-xs tracking-[0.25em] text-amber-600 uppercase mb-2">Artist</div>
                  <h3 className="text-xl text-amber-50 leading-tight mb-1">
                    {current.artist_name}
                  </h3>
                  <div className="text-stone-400 text-sm italic mb-2">{current.artist_lifespan} · {current.artist_role}</div>
                  <p className="text-sm text-stone-300 leading-relaxed">{current.artist_bio}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => decide("include")}
                  className="flex-1 min-w-[140px] px-5 py-4 bg-emerald-700 hover:bg-emerald-600 text-stone-50 font-semibold tracking-wide transition group"
                >
                  <span className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-0.5">Include</span>
                  <span className="text-lg">Keep this one</span>
                  <span className="ml-2 text-xs opacity-50">[Y]</span>
                </button>
                <button
                  onClick={() => decide("exclude")}
                  className="flex-1 min-w-[140px] px-5 py-4 bg-rose-900 hover:bg-rose-800 text-stone-50 font-semibold tracking-wide transition"
                >
                  <span className="text-xs tracking-[0.2em] uppercase opacity-70 block mb-0.5">Exclude</span>
                  <span className="text-lg">Pass</span>
                  <span className="ml-2 text-xs opacity-50">[N]</span>
                </button>
                <button
                  onClick={() => decide("skip")}
                  className="px-4 py-4 border border-stone-700 hover:border-amber-600 text-stone-300 hover:text-amber-300 transition"
                >
                  <span className="text-xs tracking-[0.2em] uppercase block mb-0.5">Skip</span>
                  <span className="text-xs opacity-50">decide later</span>
                </button>
                <a
                  href={current.object_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-4 border border-stone-700 hover:border-stone-500 text-stone-400 transition text-xs tracking-wider uppercase"
                >
                  view at {current.source_short} →
                </a>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-stone-600">
                <div className="flex gap-4">
                  <button onClick={goPrev} disabled={index === 0} className="hover:text-stone-300 disabled:opacity-30 transition">
                    ← prev
                  </button>
                  <button onClick={goNext} disabled={index === total - 1} className="hover:text-stone-300 disabled:opacity-30 transition">
                    next →
                  </button>
                  <span className="text-stone-700">·</span>
                  <span>shortcuts: Y / N / S / ← → / I to toggle this panel</span>
                </div>
                <button onClick={() => setShowSummary(true)} className="hover:text-amber-400 transition">
                  view summary →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle info button when info hidden */}
      {!showInfo && (
        <button
          onClick={() => setShowInfo(true)}
          className="absolute bottom-6 right-6 z-20 px-4 py-3 bg-stone-950/80 border border-stone-700 hover:border-amber-600 text-stone-300 hover:text-amber-400 text-xs tracking-[0.2em] uppercase transition backdrop-blur"
        >
          show controls [I]
        </button>
      )}

      {/* Existing decision indicator */}
      {decisions[current.id] && (
        <div className="absolute top-20 right-6 z-20">
          <div className={`px-3 py-1 text-xs tracking-[0.2em] uppercase backdrop-blur ${
            decisions[current.id] === "include" ? "bg-emerald-900/80 text-emerald-200 border border-emerald-700" :
            decisions[current.id] === "exclude" ? "bg-rose-900/80 text-rose-200 border border-rose-700" :
            "bg-amber-900/80 text-amber-200 border border-amber-700"
          }`}>
            {decisions[current.id] === "include" ? "✓ included" :
             decisions[current.id] === "exclude" ? "✕ excluded" : "~ skipped"}
          </div>
        </div>
      )}
    </div>
  );
}
