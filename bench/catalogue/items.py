"""The food list, Ukrainian home food first. Each row says WHERE its kcal comes from:

  usda   - USDA FoodData Central (SR Legacy / Foundation), lab-analysed, by FDC id   -> usda.json
  label  - Ukrainian product label / DSTU standard (fat levels differ from US food) -> labels.json
  recipe - calculated from a home-style Ukrainian recipe (ingredient grams, cooked
           weight), ingredients from usda/label rows, cross-checked against
           published values                                                      -> recipes.json

Row: (id, source, Ukrainian name, English name, English aliases "a; b", Ukrainian aliases, grams per piece, hint)
The English names and aliases are what the photo model's answers are matched against.
Ids of foods kept from the old MacroTrack list are unchanged (her logs and corrections use them).
Run: python -I items.py  -> items.json
"""
import json
import pathlib

ROWS = [
    # ---- soups (recipe) ----
    ("borscht", "recipe", "Борщ червоний (з м'ясом)", "Borscht", "beet soup; red borscht; borshch; beetroot soup; ukrainian borscht", "борщ; червоний борщ; борщик", None, "pork or beef, potato, cabbage, beet, carrot, onion, tomato, sunflower oil; without sour cream"),
    ("borscht-lenten", "recipe", "Борщ пісний", "Lenten borscht", "vegetarian borscht; vegan borscht; meatless borscht", "пісний борщ; борщ без м'яса", None, "no meat, vegetables and oil only"),
    ("green-borscht", "recipe", "Зелений борщ (щавлевий)", "Green borscht", "sorrel soup; green soup; spring borscht", "щавлевий борщ; зелений суп", None, "sorrel, potato, egg, without sour cream"),
    ("kapusniak", "recipe", "Капусняк", "Kapusniak", "sauerkraut soup; cabbage soup", "капусняк з квашеною капустою", None, "sauerkraut, pork, potato, millet or rice"),
    ("chicken-noodle-soup", "recipe", "Курячий суп з локшиною", "Chicken noodle soup", "chicken soup; chicken broth with noodles", "курячий бульйон; суп з локшиною", None, ""),
    ("meatball-soup", "recipe", "Суп з фрикадельками", "Meatball soup", "soup with meatballs", "фрикадельки в бульйоні", None, ""),
    ("pea-soup", "recipe", "Гороховий суп", "Pea soup", "split pea soup", "суп гороховий", None, "with smoked pork"),
    ("mushroom-soup", "recipe", "Грибна юшка", "Mushroom soup", "mushroom broth", "грибний суп", None, ""),
    ("fish-soup", "recipe", "Юшка рибна", "Fish soup", "ukha", "рибний суп; уха", None, ""),
    ("rassolnyk", "recipe", "Розсольник", "Rassolnik", "pickle soup; pickled cucumber soup", "суп з солоними огірками", None, "pearl barley, pickles"),
    ("solyanka", "recipe", "Солянка", "Solyanka", "meat solyanka", "солянка м'ясна збірна", None, ""),
    ("okroshka", "recipe", "Окрошка на кефірі", "Okroshka", "cold kefir soup", "окрошка", None, "kefir base"),
    ("kulish", "recipe", "Куліш", "Kulish", "millet soup with salo", "куліш з пшоном", None, "millet, potato, salo"),
    ("milk-noodle-soup", "recipe", "Молочний суп з вермішеллю", "Milk noodle soup", "noodles in milk", "молочна вермішель", None, ""),
    # ---- dumplings, pancakes, mains (recipe) ----
    ("varenyky-potato", "recipe", "Вареники з картоплею", "Varenyky with potato", "pierogi; potato dumplings; potato pierogi; dumplings; pyrohy", "вареники картопляні; пироги з картоплею", 25, "served with fried onion"),
    ("varenyky-cabbage", "recipe", "Вареники з капустою", "Varenyky with cabbage", "cabbage pierogi; sauerkraut dumplings", "вареники з капустою", 25, ""),
    ("varenyky-cottage-cheese", "recipe", "Вареники з сиром", "Varenyky with cottage cheese", "cheese pierogi; sweet cheese dumplings; farmer cheese dumplings", "вареники з сиром", 25, "without sour cream"),
    ("varenyky-cherry", "recipe", "Вареники з вишнями", "Varenyky with cherries", "cherry pierogi; cherry dumplings", "вареники з вишнею", 25, ""),
    ("lazy-varenyky", "recipe", "Ліниві вареники", "Lazy varenyky", "lazy dumplings; cottage cheese gnocchi", "ліниві галушки", 15, ""),
    ("pelmeni", "recipe", "Пельмені", "Pelmeni", "meat dumplings; meat pierogi", "пельмені з м'ясом", 12, ""),
    ("deruny", "recipe", "Деруни", "Deruny", "potato pancakes; latkes; potato fritters; hash brown", "картопляні млинці; деруни картопляні", 60, "fried in sunflower oil, without sour cream"),
    ("syrnyky", "recipe", "Сирники", "Syrnyky", "cottage cheese pancakes; farmer cheese pancakes; cheese fritters", "сирники з сиру", 50, "fried, without sour cream"),
    ("mlyntsi", "recipe", "Млинці", "Crepes", "thin pancakes; blini; crepe; pancakes", "млинчики; налисники без начинки", 45, "plain, milk batter"),
    ("nalysnyky-cottage-cheese", "recipe", "Налисники з сиром", "Crepes with cottage cheese", "cheese crepes; blintzes; cheese blintz", "млинці з сиром", 90, ""),
    ("nalysnyky-meat", "recipe", "Млинці з м'ясом", "Crepes with meat", "meat crepes; meat blintzes", "налисники з м'ясом", 90, ""),
    ("oladky", "recipe", "Оладки", "Oladky", "fluffy pancakes; kefir pancakes; fritters", "оладі; оладки на кефірі", 35, "fried"),
    ("holubtsi", "recipe", "Голубці", "Holubtsi", "cabbage rolls; stuffed cabbage", "голубці з м'ясом і рисом", 150, "meat and rice, stewed in tomato-sour cream sauce"),
    ("halushky", "recipe", "Галушки", "Halushky", "dough dumplings", "галушки з борошна", None, ""),
    ("banosh", "recipe", "Банош (з бринзою і шкварками)", "Banosh", "cornmeal porridge with cheese; polenta with sour cream; hutsul polenta", "банош; мамалига на сметані", None, "corn grits cooked in sour cream (+milk), topped with bryndza and shkvarky"),
    ("kotlety", "recipe", "Котлети (свинина з яловичиною)", "Cutlets", "meat patties; meatballs; patty; cutlet; burger patty", "котлети м'ясні; котлета", 80, "fried, with bread and egg"),
    ("chicken-cutlets", "recipe", "Котлети курячі", "Chicken cutlets", "chicken patties; chicken meatballs", "курячі котлети", 70, ""),
    ("chicken-kyiv", "recipe", "Котлета по-київськи", "Chicken Kyiv", "chicken kiev; breaded chicken with butter", "котлета по-київськи", 160, "deep-fried"),
    ("pork-chop-breaded", "recipe", "Відбивна свиняча", "Pork schnitzel", "breaded pork chop; schnitzel; pork cutlet", "відбивна; шніцель", 120, "breaded, fried in oil"),
    ("pechenia", "recipe", "Печеня (свинина з картоплею)", "Pechenia", "pork and potato stew; roast with potatoes", "печеня по-домашньому", None, ""),
    ("stewed-cabbage", "recipe", "Тушкована капуста з м'ясом", "Stewed cabbage with meat", "bigos; braised cabbage; braised sauerkraut", "бігос; тушкована капуста", None, ""),
    ("goulash", "recipe", "Гуляш", "Goulash", "beef stew; meat stew; stew", "гуляш з яловичини", None, ""),
    ("makaroni-po-flotsky", "recipe", "Макарони по-флотськи", "Pasta with minced meat", "navy pasta; macaroni with ground beef", "макарони з фаршем", None, ""),
    ("plov", "recipe", "Плов зі свининою", "Plov", "pilaf with meat; plov with pork", "плов", None, ""),
    ("fried-potatoes", "recipe", "Картопля смажена", "Fried potatoes", "home fries; pan-fried potatoes; roasted potatoes; potato wedges", "смажена картопля", None, "sunflower oil"),
    ("stewed-potatoes", "recipe", "Картопля тушкована з м'ясом", "Potato stew", "braised potatoes with meat", "тушкована картопля", None, ""),
    ("fried-fish", "recipe", "Риба смажена в борошні", "Fried fish", "pan-fried fish; breaded fish", "смажена риба; хек смажений", None, "hake or pollock, flour, sunflower oil"),
    ("fried-mushrooms", "recipe", "Гриби смажені з цибулею", "Fried mushrooms", "sauteed mushrooms", "смажені печериці", None, ""),
    ("fried-liver", "recipe", "Печінка смажена з цибулею", "Fried liver", "liver and onions; chicken liver", "печінка смажена", None, ""),
    ("omelette", "recipe", "Омлет з молоком", "Omelette", "omelet; scrambled eggs", "омлет", None, ""),
    ("fried-eggs", "usda", "Яєчня (смажені яйця)", "Fried eggs", "fried egg; sunny side up eggs", "яєчня; глазунья", 50, "Egg, whole, cooked, fried"),
    ("pyrizhky-potato", "recipe", "Пиріжки смажені з картоплею", "Fried pirozhki with potato", "fried hand pies; pirozhki; fried buns", "пиріжки з картоплею", 70, ""),
    ("pyrizhky-cabbage", "recipe", "Пиріжки печені з капустою", "Baked pirozhki with cabbage", "baked hand pies; cabbage buns", "пиріжки з капустою", 60, ""),
    ("pyrizhky-cherry", "recipe", "Пиріжки з вишнями", "Cherry pirozhki", "cherry buns; cherry hand pies", "пиріжки з вишнею", 60, ""),
    ("pampushky", "recipe", "Пампушки з часником", "Pampushky", "garlic buns; garlic rolls", "пампушки", 40, ""),
    ("holodets", "recipe", "Холодець", "Kholodets", "meat jelly; aspic", "холодець зі свинини; студень", None, "pork + beef, home style"),
    ("kutia", "recipe", "Кутя", "Kutia", "wheat berry pudding; christmas kutia", "кутя з маком", None, "wheat, poppy seeds, honey, nuts"),
    # ---- porridges and sides ----
    ("buckwheat-cooked", "usda", "Гречка варена", "Buckwheat", "buckwheat groats; kasha; buckwheat porridge", "гречана каша; гречка", None, "Buckwheat groats, roasted, cooked"),
    ("white-rice-cooked", "usda", "Рис варений", "Rice", "white rice; boiled rice; steamed rice", "рис", None, "Rice, white, long-grain, regular, cooked"),
    ("millet-porridge", "usda", "Пшоняна каша на воді", "Millet porridge", "millet", "пшоно; пшонка", None, "Millet, cooked"),
    ("pearl-barley-cooked", "usda", "Перлова каша", "Pearl barley", "barley", "перловка", None, "Barley, pearled, cooked"),
    ("oatmeal-water", "usda", "Вівсянка на воді", "Oatmeal", "porridge; oat porridge", "вівсяна каша на воді", None, "Cereals, oats, regular and quick, cooked with water, without salt"),
    ("oatmeal-milk", "recipe", "Вівсянка на молоці", "Oatmeal with milk", "milk porridge; oats with milk", "вівсяна каша на молоці", None, ""),
    ("semolina-porridge", "recipe", "Манна каша на молоці", "Semolina porridge", "cream of wheat; semolina", "манка", None, ""),
    ("corn-porridge", "usda", "Кукурудзяна каша на воді (мамалига)", "Corn porridge", "polenta; grits; cornmeal mush", "мамалига; кукурудзяна каша", None, "Cornmeal / grits cooked with water"),
    ("pasta-cooked", "usda", "Макарони варені", "Pasta", "noodles; spaghetti; macaroni; vermicelli", "макарони; вермішель; спагеті", None, "Pasta, cooked, enriched"),
    ("potato-boiled", "usda", "Картопля варена", "Boiled potatoes", "potatoes; potato; jacket potatoes", "картопля; бульба; картопля в мундирі", None, "Potatoes, boiled, cooked without skin, flesh, without salt"),
    ("mashed-potatoes", "usda", "Картопляне пюре", "Mashed potatoes", "potato puree", "пюре; товчена картопля", None, "Potatoes, mashed, home-prepared, whole milk and butter added"),
    ("baked-potatoes", "usda", "Картопля запечена", "Baked potatoes", "oven potatoes", "печена картопля", None, "Potatoes, baked, flesh and skin"),
    # ---- salads and cold dishes (recipe) ----
    ("olivier-salad", "recipe", "Олів'є", "Olivier salad", "russian salad; potato salad with mayonnaise", "салат олів'є; олів'є з ковбасою", None, "boiled sausage, mayonnaise"),
    ("vinaigrette-salad", "recipe", "Вінегрет", "Vinaigrette salad", "beet salad with sauerkraut", "вінегрет з олією", None, ""),
    ("shuba", "recipe", "Оселедець під шубою", "Herring under a fur coat", "layered herring salad", "шуба", None, ""),
    ("cabbage-salad", "recipe", "Салат з капусти з олією", "Cabbage salad", "coleslaw; slaw", "капустяний салат", None, ""),
    ("cucumber-tomato-salad", "recipe", "Салат з огірків і помідорів з олією", "Cucumber tomato salad", "tomato cucumber salad; summer salad", "овочевий салат", None, "sunflower oil"),
    ("cucumber-tomato-salad-smetana", "recipe", "Салат з огірків і помідорів зі сметаною", "Cucumber tomato salad with sour cream", "salad with sour cream", "салат зі сметаною", None, ""),
    ("crab-salad", "recipe", "Крабовий салат", "Crab stick salad", "crab salad", "салат з крабовими паличками", None, ""),
    ("beet-salad", "recipe", "Буряк з часником і майонезом", "Beet salad", "beetroot salad", "салат з буряка", None, ""),
    ("korean-carrot", "recipe", "Морква по-корейськи", "Korean carrot salad", "spicy carrot salad", "корейська морква", None, ""),
    ("squash-caviar", "label", "Кабачкова ікра", "Squash caviar", "zucchini spread", "ікра кабачкова", None, "Ukrainian canned, label"),
    # ---- meat and poultry ----
    ("chicken-breast-cooked", "usda", "Куряче філе (варене/запечене)", "Chicken breast", "grilled chicken; chicken fillet; boiled chicken", "куряча грудка; філе", None, "Chicken, broilers or fryers, breast, meat only, cooked, roasted"),
    ("chicken-leg-cooked", "usda", "Курячі стегна/гомілки запечені (зі шкірою)", "Chicken leg", "chicken thigh; drumstick; chicken legs", "курячі ніжки; стегно; гомілка", None, "Chicken, thigh / drumstick, meat and skin, cooked, roasted"),
    ("roast-chicken", "usda", "Курка запечена (зі шкірою)", "Roast chicken", "roasted chicken; baked chicken; rotisserie chicken", "запечена курка", None, "Chicken, broilers or fryers, meat and skin, cooked, roasted"),
    ("turkey-breast-cooked", "usda", "Індичка (філе, запечене)", "Turkey", "turkey breast; roast turkey", "індиче філе", None, "Turkey, breast, meat only, roasted"),
    ("pork-roast", "usda", "Свинина запечена", "Roast pork", "pork; pork loin; baked pork", "свинина; буженина", None, "Pork, fresh, loin, whole, separable lean and fat, cooked, roasted"),
    ("pork-chop-cooked", "usda", "Свиняча відбивна без паніровки", "Pork chop", "grilled pork chop; pan-fried pork", "свиняча відбивна; свинина смажена", 120, "Pork, fresh, loin, center loin (chops), bone-in, separable lean and fat, cooked, pan-fried"),
    ("beef-cooked", "usda", "Яловичина варена/тушкована", "Beef", "boiled beef; braised beef; beef steak; steak", "яловичина", None, "Beef, chuck, separable lean and fat, cooked, braised"),
    ("beef-liver-fried", "usda", "Печінка яловича смажена", "Beef liver", "liver", "печінка", None, "Beef, variety meats and by-products, liver, cooked, pan-fried"),
    ("salo", "usda", "Сало солоне", "Salo", "pork fat; lard; fatback; cured pork fat", "сало; солоне сало", None, "Pork, fresh, backfat, raw"),
    ("shkvarky", "recipe", "Шкварки", "Shkvarky", "pork cracklings; cracklings; fried pork fat", "шкварки зі сала", None, "rendered salo"),
    ("bacon-cooked", "usda", "Бекон смажений", "Bacon", "fried bacon", "бекон", None, "Pork, cured, bacon, cooked, pan-fried"),
    ("kovbasa-boiled", "label", "Ковбаса варена (Лікарська, Молочна)", "Bologna", "boiled sausage; doctor's sausage; baloney", "варена ковбаса; лікарська", None, "DSTU 4436, label"),
    ("kovbasa-smoked", "label", "Ковбаса напівкопчена", "Smoked sausage", "salami; kielbasa; smoked kielbasa", "копчена ковбаса; салямі", None, "Ukrainian label"),
    ("kovbasa", "usda", "Ковбаса домашня (смажена)", "Homemade sausage", "pork sausage; sausage; polish sausage", "домашня ковбаса; ковбаса", None, "Polish sausage, pork / kielbasa"),
    ("sosysky", "label", "Сосиски", "Frankfurters", "hot dogs; wieners; sausages", "сосиски молочні; сардельки", 50, "Ukrainian label"),
    ("ham", "label", "Шинка варена", "Ham", "sliced ham; boiled ham", "шинка", None, "Ukrainian label"),
    ("krovianka", "label", "Кров'янка", "Blood sausage", "black pudding; blood pudding", "кров'яна ковбаса", None, "Ukrainian label, with groats"),
    # ---- fish ----
    ("hake-cooked", "usda", "Хек / минтай (варений, запечений)", "White fish", "hake; pollock; cod; fish", "хек; минтай; тріска", None, "Fish, pollock, Alaska, cooked, dry heat"),
    ("salmon-cooked", "usda", "Лосось запечений", "Salmon", "baked salmon; salmon fillet; trout", "лосось; сьомга; форель", None, "Fish, salmon, Atlantic, farmed, cooked, dry heat"),
    ("mackerel-smoked", "usda", "Скумбрія копчена", "Smoked mackerel", "mackerel", "скумбрія", None, "Fish, mackerel, Atlantic, cooked, dry heat (smoked ~ cooked)"),
    ("herring-salted", "label", "Оселедець солоний", "Herring", "pickled herring; salted herring", "оселедець; селедка", None, "Ukrainian label, fillet in oil/salted"),
    ("carp-fried", "recipe", "Короп / карась смажений", "Fried carp", "carp", "короп; карась", None, ""),
    ("sprats", "label", "Шпроти в олії", "Sprats", "smoked sprats", "шпроти", None, "Ukrainian/Latvian label"),
    ("tuna-canned", "usda", "Тунець консервований у власному соку", "Tuna", "canned tuna", "тунець", None, "Fish, tuna, light, canned in water, drained solids"),
    ("crab-sticks", "label", "Крабові палички", "Crab sticks", "imitation crab; surimi", "крабове м'ясо", 25, "Ukrainian label"),
    ("shrimp-cooked", "usda", "Креветки варені", "Shrimp", "prawns", "креветки", None, "Crustaceans, shrimp, cooked"),
    # ---- eggs and dairy ----
    ("eggs-whole", "usda", "Яйця варені", "Eggs", "boiled eggs; hard boiled egg; egg", "яйце; яйця", 50, "Egg, whole, cooked, hard-boiled"),
    ("milk-2-5", "label", "Молоко 2,5%", "Milk", "low fat milk", "молоко", None, "Ukrainian label 2.5%"),
    ("whole-milk", "usda", "Молоко 3,2%", "Whole milk", "full fat milk", "молоко домашнє", None, "Milk, whole, 3.25% milkfat"),
    ("kefir", "label", "Кефір 2,5%", "Kefir", "buttermilk", "кефір", None, "Ukrainian label 2.5%"),
    ("ryazhenka", "label", "Ряжанка 4%", "Ryazhenka", "baked milk yogurt", "ряжанка", None, "Ukrainian label 4%"),
    ("yogurt-natural", "usda", "Йогурт натуральний", "Yogurt", "plain yogurt; greek yogurt", "йогурт", None, "Yogurt, plain, whole milk"),
    ("smetana-15", "label", "Сметана 15%", "Sour cream", "smetana", "сметана; сметанка", None, "Ukrainian label 15%"),
    ("smetana-20", "label", "Сметана 20%", "Sour cream 20%", "thick sour cream", "сметана жирна", None, "Ukrainian label 20%"),
    ("tvorog-5", "label", "Сир кисломолочний 5%", "Cottage cheese", "farmer cheese; quark; tvorog", "сир; творог; кисломолочний сир", None, "Ukrainian label 5%"),
    ("tvorog-9", "label", "Сир кисломолочний 9%", "Cottage cheese 9%", "full fat farmer cheese", "сир жирний; домашній сир", None, "Ukrainian label 9%"),
    ("bryndza", "label", "Бринза", "Bryndza", "sheep cheese; brine cheese; feta", "бринза; фета", None, "Ukrainian label"),
    ("hard-cheese", "usda", "Сир твердий (Голландський, Гауда)", "Cheese", "hard cheese; gouda; cheddar; sliced cheese", "твердий сир; сир голландський", None, "Cheese, gouda"),
    ("processed-cheese", "label", "Сирок плавлений", "Processed cheese", "cheese spread", "плавлений сир", 70, "Ukrainian label"),
    ("butter", "label", "Масло вершкове 82%", "Butter", "", "масло; вершкове масло", None, "Ukrainian label 82.5%"),
    # ---- bread and baking ----
    ("white-bread", "usda", "Хліб пшеничний, батон", "Bread", "white bread; baton; toast; loaf", "хліб; батон; булка", 30, "Bread, white, commercially prepared"),
    ("rye-bread", "label", "Хліб житній", "Rye bread", "dark bread; black bread; borodinsky", "чорний хліб; житній хліб; бородинський", 30, "Ukrainian label (Дарницький / житній)"),
    ("lavash", "usda", "Лаваш", "Lavash", "flatbread; pita", "лаваш", None, "Bread, pita, white"),
    ("oats-dry", "usda", "Вівсяні пластівці (сухі)", "Oat flakes", "rolled oats; oats", "вівсяні пластівці; геркулес", None, "Cereals, oats, regular and quick, not fortified, dry"),
    ("cookies", "label", "Печиво (цукрове)", "Cookies", "biscuits; cookie", "печиво", 10, "Ukrainian label, sugar cookies"),
    ("gingerbread", "label", "Пряник", "Gingerbread", "honey cake cookie", "пряники", 40, "Ukrainian label"),
    ("medivnyk", "recipe", "Медівник", "Honey cake", "medovik; layered honey cake", "медовик; медовий торт", None, ""),
    ("napoleon-cake", "recipe", "Торт Наполеон", "Napoleon cake", "mille-feuille; puff pastry cake", "наполеон", None, ""),
    ("kyiv-cake", "label", "Київський торт", "Kyiv cake", "kiev cake; meringue cake", "київський торт", None, "Roshen label"),
    ("apple-pie", "recipe", "Шарлотка (пиріг з яблуками)", "Apple pie", "apple cake; charlotte", "шарлотка; яблучний пиріг", None, ""),
    ("paska", "recipe", "Паска", "Easter bread", "paska; kulich", "паска великодня", None, ""),
    # ---- sweets ----
    ("sugar", "usda", "Цукор", "Sugar", "white sugar", "цукор", None, "Sugars, granulated"),
    ("honey", "usda", "Мед", "Honey", "", "мед", None, "Honey"),
    ("jam", "label", "Варення", "Jam", "preserves; jelly", "варення; джем; повидло", None, "Ukrainian label / home preserves"),
    ("halva", "label", "Халва соняшникова", "Halva", "sunflower halva", "халва", None, "Ukrainian label"),
    ("milk-chocolate", "usda", "Шоколад молочний", "Milk chocolate", "chocolate", "шоколад", None, "Candies, milk chocolate"),
    ("dark-chocolate-70", "usda", "Шоколад чорний 70%", "Dark chocolate", "bitter chocolate", "чорний шоколад; гіркий шоколад", None, "Chocolate, dark, 70-85% cacao solids"),
    ("chocolate-candies", "label", "Цукерки шоколадні", "Chocolate candies", "candy; bonbons; chocolates", "цукерки", 12, "Ukrainian label (Roshen)"),
    ("condensed-milk", "label", "Згущене молоко", "Condensed milk", "sweetened condensed milk", "згущенка", None, "Ukrainian label"),
    ("ice-cream", "label", "Морозиво пломбір", "Ice cream", "vanilla ice cream", "пломбір; морозиво", None, "Ukrainian label"),
    # ---- vegetables ----
    ("cabbage-raw", "usda", "Капуста білокачанна", "Cabbage", "white cabbage; green cabbage; brussels sprouts; savoy cabbage", "капуста", None, "Cabbage, raw"),
    ("sauerkraut", "usda", "Капуста квашена", "Sauerkraut", "pickled cabbage", "квашена капуста", None, "Sauerkraut, canned, solids and liquids"),
    ("beet-boiled", "usda", "Буряк варений", "Beets", "beetroot; boiled beets", "буряк; бурячок", None, "Beets, cooked, boiled, drained"),
    ("carrots-raw", "usda", "Морква", "Carrot", "carrots", "морква", None, "Carrots, raw"),
    ("onion", "usda", "Цибуля", "Onion", "", "цибуля", None, "Onions, raw"),
    ("cucumber", "usda", "Огірок свіжий", "Cucumber", "fresh cucumber", "огірок; огірочки", None, "Cucumber, with peel, raw"),
    ("pickled-cucumber", "usda", "Огірок солоний / маринований", "Pickles", "pickled cucumber; dill pickle; gherkins", "солоні огірки; мариновані огірки", None, "Pickles, cucumber, dill or kosher dill"),
    ("tomato", "usda", "Помідор", "Tomato", "tomatoes; cherry tomatoes", "помідори; томат", None, "Tomatoes, red, ripe, raw"),
    ("bell-pepper", "usda", "Перець солодкий", "Bell pepper", "sweet pepper; red pepper", "болгарський перець", None, "Peppers, sweet, red, raw"),
    ("zucchini", "usda", "Кабачок", "Zucchini", "courgette; squash", "кабачки", None, "Squash, summer, zucchini, raw"),
    ("eggplant", "usda", "Баклажан", "Eggplant", "aubergine", "синенькі", None, "Eggplant, raw"),
    ("mushrooms-raw", "usda", "Печериці", "Mushrooms", "champignons", "гриби", None, "Mushrooms, white, raw"),
    ("mixed-greens", "usda", "Листя салату, зелень", "Lettuce", "salad greens; leafy greens; mixed greens; spinach; baby spinach; kale; arugula", "салат; зелень; кріп; петрушка", None, "Lettuce, green leaf, raw"),
    ("radish", "usda", "Редиска", "Radishes", "radish", "редиска", None, "Radishes, raw"),
    ("green-peas", "usda", "Горошок консервований", "Green peas", "peas", "горошок", None, "Peas, green, canned, drained"),
    ("corn-canned", "usda", "Кукурудза консервована", "Sweet corn", "corn", "кукурудза", None, "Corn, sweet, yellow, canned, drained"),
    ("kidney-beans-cooked", "usda", "Квасоля варена", "Beans", "kidney beans; white beans", "квасоля", None, "Beans, kidney, cooked, boiled"),
    ("green-beans", "usda", "Квасоля стручкова", "Green beans", "string beans", "стручкова квасоля", None, "Beans, snap, green, cooked, boiled"),
    ("pumpkin", "usda", "Гарбуз", "Pumpkin", "squash", "гарбуз", None, "Pumpkin, raw"),
    ("cauliflower", "usda", "Цвітна капуста", "Cauliflower", "", "цвітна капуста", None, "Cauliflower, cooked, boiled"),
    ("broccoli-cooked", "usda", "Броколі", "Broccoli", "", "броколі", None, "Broccoli, cooked, boiled"),
    # ---- fruit and berries ----
    ("apple", "usda", "Яблуко", "Apple", "apples; green apple; red apple", "яблука", 170, "Apples, raw, with skin"),
    ("pear", "usda", "Груша", "Pear", "pears", "груші", 170, "Pears, raw"),
    ("plum", "usda", "Слива", "Plum", "plums", "сливи", 30, "Plums, raw"),
    ("apricot", "usda", "Абрикос", "Apricot", "apricots", "абрикоси", 35, "Apricots, raw"),
    ("peach", "usda", "Персик", "Peach", "peaches; nectarine", "персики; нектарин", 150, "Peaches, raw"),
    ("cherries-sour", "usda", "Вишні", "Cherries", "sour cherries", "вишня", None, "Cherries, sour, red, raw"),
    ("sweet-cherries", "usda", "Черешні", "Sweet cherries", "", "черешня", None, "Cherries, sweet, raw"),
    ("strawberries", "usda", "Полуниці", "Strawberries", "strawberry", "полуниця; суниці", None, "Strawberries, raw"),
    ("raspberries", "usda", "Малина", "Raspberries", "raspberry", "малина", None, "Raspberries, raw"),
    ("blueberries", "usda", "Чорниці / лохина", "Blueberries", "bilberries", "чорниця; лохина", None, "Blueberries, raw"),
    ("currants", "usda", "Смородина", "Currants", "black currants; red currants", "смородина", None, "Currants, european black, raw"),
    ("berries-mix", "usda", "Ягоди (мікс)", "Berries", "mixed berries; blackberries", "ягоди", None, "average of strawberries/raspberries/blueberries"),
    ("grapes", "usda", "Виноград", "Grapes", "", "виноград", None, "Grapes, red or green, raw"),
    ("watermelon", "usda", "Кавун", "Watermelon", "", "кавун", None, "Watermelon, raw"),
    ("melon", "usda", "Диня", "Melon", "cantaloupe; honeydew", "диня", None, "Melons, cantaloupe, raw"),
    ("banana", "usda", "Банан", "Banana", "bananas", "банани", 120, "Bananas, raw"),
    ("orange", "usda", "Апельсин", "Orange", "oranges", "апельсини", 160, "Oranges, raw, all commercial varieties"),
    ("mandarin", "usda", "Мандарин", "Tangerine", "mandarin; clementine", "мандарини", 80, "Tangerines (mandarin oranges), raw"),
    ("lemon", "usda", "Лимон", "Lemon", "", "лимон", None, "Lemons, raw, without peel"),
    ("kiwi", "usda", "Ківі", "Kiwi", "kiwifruit", "ківі", 75, "Kiwifruit, green, raw"),
    ("persimmon", "usda", "Хурма", "Persimmon", "", "хурма", 170, "Persimmons, japanese, raw"),
    ("raisins", "usda", "Родзинки", "Raisins", "", "ізюм", None, "Raisins, seedless"),
    ("prunes", "usda", "Чорнослив", "Prunes", "dried plums", "чорнослив", None, "Plums, dried (prunes), uncooked"),
    ("dried-apricots", "usda", "Курага", "Dried apricots", "", "курага", None, "Apricots, dried, sulfured, uncooked"),
    # ---- nuts, seeds, fats, sauces ----
    ("walnuts", "usda", "Волоські горіхи", "Walnuts", "nuts", "горіхи", None, "Nuts, walnuts, english"),
    ("hazelnuts", "usda", "Фундук", "Hazelnuts", "", "лісові горіхи", None, "Nuts, hazelnuts or filberts"),
    ("almonds", "usda", "Мигдаль", "Almonds", "", "мигдаль", None, "Nuts, almonds"),
    ("peanuts", "usda", "Арахіс", "Peanuts", "", "арахіс", None, "Peanuts, all types, dry-roasted"),
    ("sunflower-seeds", "usda", "Насіння соняшника", "Sunflower seeds", "seeds", "насіння; соняшникове насіння", None, "Seeds, sunflower seed kernels, dry roasted"),
    ("pumpkin-seeds", "usda", "Гарбузове насіння", "Pumpkin seeds", "", "гарбузове насіння", None, "Seeds, pumpkin and squash seed kernels, roasted"),
    ("sunflower-oil", "usda", "Олія соняшникова", "Sunflower oil", "oil", "олія", None, "Oil, sunflower"),
    ("olive-oil", "usda", "Олія оливкова", "Olive oil", "", "оливкова олія", None, "Oil, olive, salad or cooking"),
    ("mayonnaise", "label", "Майонез 67%", "Mayonnaise", "mayo", "майонез", None, "Ukrainian label, Provansal 67%"),
    ("ketchup", "label", "Кетчуп", "Ketchup", "tomato sauce", "кетчуп; томатний соус", None, "Ukrainian label"),
    ("mustard", "label", "Гірчиця", "Mustard", "", "гірчиця", None, "Ukrainian label"),
    # ---- drinks ----
    ("uzvar", "recipe", "Узвар", "Uzvar", "uzvar drink", "узвар", None, "with sugar"),
    ("kompot", "recipe", "Компот", "Kompot", "compote", "компот", None, "with sugar"),
    ("kvass", "label", "Квас", "Kvass", "", "квас хлібний", None, "Ukrainian label"),
    ("juice", "usda", "Сік (яблучний, апельсиновий)", "Juice", "apple juice; orange juice", "сік", None, "Apple juice, canned or bottled, unsweetened"),
    ("black-coffee", "usda", "Кава без цукру", "Coffee", "black coffee", "кава", None, "Beverages, coffee, brewed"),
    ("green-tea", "usda", "Чай без цукру", "Tea", "green tea; black tea", "чай", None, "Beverages, tea, brewed"),
]

# Old MacroTrack ids that are not in the new list -> the closest new food (None = drop).
# Used to move her learned corrections and keeps recents meaningful.
OLD_TO_NEW = {
    "chicken-thigh-raw": "chicken-leg-cooked", "beef-mince-raw-15": "kotlety", "beef-steak-raw": "beef-cooked",
    "lamb-cooked": "beef-cooked", "pork-sausage": "kovbasa", "salmon-raw": "salmon-cooked",
    "tuna-canned-in-water": "tuna-canned", "cod-cooked": "hake-cooked", "egg-whites": "eggs-whole",
    "brown-rice-cooked": "white-rice-cooked", "whole-wheat-bread": "rye-bread", "skimmed-milk": "milk-2-5",
    "greek-yogurt-full-fat": "yogurt-natural", "greek-yogurt-0-fat": "yogurt-natural",
    "cottage-cheese-low-fat": "tvorog-5", "cheddar-cheese": "hard-cheese", "parmesan-cheese": "hard-cheese",
    "mozzarella": "hard-cheese", "feta-cheese": "bryndza", "ricotta-cheese": "tvorog-9", "cream-cheese": "processed-cheese",
    "herring-smoked": "herring-salted", "mackerel-canned": "mackerel-smoked", "sardines-canned": "sprats",
    "tilapia-cooked": "hake-cooked", "haddock-cooked": "hake-cooked", "turkey-mince-cooked": "turkey-breast-cooked",
    "duck-breast-cooked": "roast-chicken", "black-beans-cooked": "kidney-beans-cooked", "lentils-cooked": "kidney-beans-cooked",
    "chickpeas-cooked": "kidney-beans-cooked", "smetana-20": "smetana-20", "tvorog-9": "tvorog-9",
    "black-pudding": "krovianka", "dark-chocolate-70": "dark-chocolate-70", "grapefruit": "orange",
    "berries-mix": "berries-mix", "trail-mix": "walnuts", "cashews": "almonds", "pistachios": "almonds",
    "pecans": "walnuts", "macadamia-nuts": "hazelnuts", "coconut-oil": "sunflower-oil",
    "kale-raw": "mixed-greens", "spinach-raw": "mixed-greens", "cauliflower-rice": "cauliflower",
    "zucchini-noodles": "zucchini", "asparagus-cooked": "green-beans", "brussels-sprouts-cooked": "cabbage-raw",
    "sweet-potato-baked": "baked-potatoes", "dates-dried": "raisins", "dried-cranberries": "raisins",
    "mango": "peach", "pineapple": "orange", "avocado": None, "hummus": None, "tahini": None,
    "full-english-breakfast": "fried-eggs", "fish-and-chips": "fried-fish", "bangers-and-mash": "mashed-potatoes",
    "roast-turkey": "turkey-breast-cooked", "fried-chicken": "chicken-leg-cooked", "meatloaf": "kotlety",
    "american-pancakes": "oladky", "grits": "corn-porridge", "pork-chop-cooked": "pork-chop-cooked",
}

def main() -> None:
    out = []
    ids = set()
    for fid, src, ua, en, al, al_ua, pc, hint in ROWS:
        assert fid not in ids, fid
        assert src in ("usda", "label", "recipe"), (fid, src)
        ids.add(fid)
        out.append({
            "id": fid, "source": src, "name": ua, "nameEn": en,
            "aliases": [a.strip() for a in al.split(";") if a.strip()],
            "aliasesUa": [a.strip() for a in al_ua.split(";") if a.strip()],
            **({"pcGrams": pc} if pc else {}), "hint": hint,
        })
    bad = {k: v for k, v in OLD_TO_NEW.items() if v is not None and v not in ids}
    assert not bad, bad
    path = pathlib.Path(__file__).with_name("items.json")
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    # Old ids that changed (kept ids map to themselves and are left out).
    renamed = {k: v for k, v in OLD_TO_NEW.items() if k != v}
    path.with_name("renamed.json").write_text(json.dumps(renamed, indent=1, sort_keys=True) + "\n")
    print(len(out), "items:", {s: sum(1 for r in out if r["source"] == s) for s in ("usda", "label", "recipe")})

if __name__ == "__main__":
    main()
