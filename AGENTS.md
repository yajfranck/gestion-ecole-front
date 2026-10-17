1. pour chaque demande ou implémentation, check les points suivants

- la doc projet dans /Users/franckyaj/developpement/gestion-ecole/README.md
- la doc api dans 
le swagger : /Users/franckyaj/developpement/gestion-ecole/swagger.yaml
 la doc des apis : /Users/franckyaj/developpement/gestion-ecole/doc-api.md

2. Reespecte les bonnes pratique
- modularité des composants pour facilité les maintenance

3. si tu pense que un composant peut être utilisé plusieurs alors factorise ce composant et réutilise le ailleur.

4. gardé la meme cohérence, les mêmes couleurs des boutons, le même theme, la même police, les modal etc sur chaque page.

5. pour le css nous allons utiliser tailwindcss

6. quand tu fais le serve, rassurer toi juste qu'il n'y a pas d'erreurs dans la console et que l'application se charge correctement. puis arrête le serveur.

7. chaque composant (html, ts n css et spec) doit être packagé correctement et suivre la structure standard du projet; de meme les service doivent suivre la même règle.


9. voici la structure de packaging que je veux; par exemple:
- components
  - employee
    - employee-list
    - employee-form
    - ...
  - position
    - position-list
    - position-form
    - etc..
- models
  - employee
  - position
  - role
  - etc.. 
- service
 - employee-service
 - position-service
 - role-service
 - etc

10. Apres chaque implémentation, vérifie que tout fonctionne correctement (tests unitaires) et que le code respecte les bonnes pratiques définies ci-dessus.

ps: - version angular: 20
 - toutes les réponses doivent être en français