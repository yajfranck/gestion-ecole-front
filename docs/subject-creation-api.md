# Création des matières

Contrat vérifié dans `doc-api.md` et `swagger.yaml` du backend le 21 octobre 2026.

Le formulaire partagé `SubjectFormComponent` crée de 1 à 100 matières dans la modale du catalogue de l’établissement. Nom et code sont alignés dans une grille commune. Le code est facultatif en création : un champ vide est omis du JSON, les codes renseignés sont nettoyés et normalisés en majuscules. Les noms restent obligatoires (100 caractères maximum), les codes sont limités à 40 caractères et doivent être distincts dans le lot après normalisation.

`SubjectService.createSubjects` appelle toujours `POST /establishments/{establishmentId}/subjects` :

```json
{"subjects":[{"name":"Mathématiques","code":"MATH"},{"name":"Français"}]}
```

Même pour une seule matière, le corps contient `subjects` et la réponse est un tableau, conservé dans l’ordre renvoyé par le serveur. L’ancien appel unitaire a été retiré du client. L’alias `/subjects/batch` reste déclaré dans la liste des permissions, mais le formulaire utilise la route principale.

Une erreur de création conserve tout le lot dans la modale et affiche un message près des champs ainsi qu’un toast. Le succès ferme la modale, confirme le nombre de matières créées et actualise le catalogue. Le serveur garantit la transaction atomique et contrôle l’unicité des codes dans l’établissement.

La modification reste un `PATCH /subjects/{subjectId}` avec un objet `{name, code}` et une réponse objet. Le code reste obligatoire en modification conformément au schéma `UpdateSubjectRequest` ; ce contrat n’a pas changé. L’archivage reste un `DELETE` sur la même ressource.
