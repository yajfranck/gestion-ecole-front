# Parcours d’inscription et consultation des élèves

Le menu **Inscriptions** est le point d’entrée de création des dossiers. Le parcours en modale comprend trois grandes étapes :

1. **Identité de l’élève** : création du dossier (prénom et nom, numéro généré par le serveur) ou choix d’un dossier existant, notamment pour les réinscriptions.
2. **Parent ou tuteur** : consultation des liens existants, création ou réutilisation du compte à partir de son adresse e-mail. Au moins un tuteur enregistré est nécessaire pour continuer.
3. **Classe et encaissement** : choix de la classe et de sa salle, lecture des frais et soldes actuels, préparation des versements, contrôle récapitulatif et confirmation finale.

La modale utilise la largeur `extra-wide`. Chaque étape présente les trois mêmes actions sur une ligne : **Étape précédente**, **Enregistrer et quitter**, **Enregistrer et continuer**. La première action reste visible mais désactivée au début. À l’étape classe et encaissement, elle parcourt aussi les sous-étapes affectation, règlement et récapitulatif. Au récapitulatif final, seules les actions **Étape précédente** et **Terminer** restent affichées, alignées sur deux colonnes. **Terminer** confirme l’inscription et ses paiements. Revenir au règlement rétablit les trois actions habituelles.

L’étape tuteurs utilise une grille commune avec prénom, nom, e-mail et actions SVG sur la même ligne à partir du format tablette. **Ajouter un tuteur** crée une ligne supplémentaire. Le crayon réactive une ligne de saisie mise en lecture seule lors de l’ajout suivant ; la corbeille retire une ligne en cours ou demande confirmation avant de retirer un lien existant. Les identités déjà enregistrées sont présentées en lecture seule, conformément au contrat API. Les champs s’adaptent au mobile sans défilement horizontal.

Les lignes sont validées ensemble avant envoi (champs, longueurs, e-mails et doublons), puis enregistrées successivement par l’API unitaire. Une réussite partielle reste acquise : après un refus, seules les lignes restantes sont renvoyées. La progression ne passe à la classe qu’une fois toutes les saisies enregistrées. Les brouillons conservent plusieurs lignes, y compris incomplètes, tout en restant compatibles avec les anciens brouillons à tuteur unique.

L’identité et le lien du tuteur sont enregistrés au fil des validations via les API existantes. L’inscription et ses paiements restent dans l’unique transaction `POST .../enrollments`. Ni la saisie d’un montant ni la sauvegarde d’un brouillon n’encaisse de paiement. Les permissions de création, lecture des élèves, liaison/lecture des tuteurs, classes, inscriptions et encaissement restent distinctes.

## Retour et modification

Le bouton **Étape précédente** et les étapes du bandeau permettent de revenir en arrière avant la confirmation finale. L’identité est préremplie : avec `can_student_update`, sa validation utilise `PATCH .../students/{studentId}` et conserve le numéro et l’identifiant du dossier. Seuls les champs modifiés sont transmis. Une identité inchangée ne déclenche aucune écriture. Sans ce droit, l’identité reste consultable et le parcours peut continuer.

Les modifications d’identité non encore validées restent dans le brouillon à l’étape 1, y compris après fermeture et reprise. Elles doivent être validées avant de passer aux étapes suivantes. Les informations du tuteur en cours, l’affectation et les versements préparés sont conservés lors des retours. Aucun paiement n’est envoyé automatiquement.

`EnrollmentContextService` est fourni par la modale du parcours. Il conserve en mémoire le dossier élève déjà connu, les tuteurs, les salles de chaque classe, les définitions de frais, les soldes de l’élève et les moyens de paiement. Les retours et allers-retours réutilisent ces données sans nouveaux appels GET, même si les formulaires sont recréés. Les requêtes en cours sont partagées ; les lectures en erreur peuvent être retentées. Les classes proviennent déjà du contexte de la page Inscriptions.

Après un PATCH de l’identité ou un ajout/retrait de tuteur, la réponse est répercutée dans ce contexte sans relecture systématique. Une autre classe utilise ses propres salles et recalcule les frais applicables à partir du catalogue chargé. Le contexte est propre au parcours, à l’établissement, à l’année et à l’élève ; il ne constitue pas un cache global et disparaît à la fermeture. La reprise d’un brouillon ouvre un nouveau contexte et relit les données nécessaires. Un refus d’enregistrement invalide les données financières et l’action **Actualiser les frais applicables** force leur relecture. La validation des capacités, soldes et paiements reste assurée par la transaction serveur.

À l’étape tuteur, les liens existants peuvent être ajoutés ou retirés selon les permissions, avec confirmation avant retrait. La suppression du dernier lien bloque la suite jusqu’à l’enregistrement d’un tuteur. **Le contrat API actuel ne permet pas de modifier l’identité d’un tuteur existant** : un nouveau `POST` avec la même adresse ne le renomme pas et ne sert pas de mise à jour.

## Sauvegarde et reprise

`EnrollmentDraftService` conserve les saisies en cours dans `localStorage`, avec une clé séparée par compte (`sub` du JWT), établissement et année. Le brouillon comprend l’identité non encore validée, l’identifiant du dossier créé, les informations de tuteur en cours, les choix d’affectation et les versements préparés. Le mot de passe, les jetons et les informations d’accès ne sont jamais inclus dans le brouillon.

Les champs sont sauvegardés pendant la saisie ; **Enregistrer et quitter** ou la fermeture de la modale conserve le parcours. Une écriture métier en cours empêche sa fermeture. Si le stockage local échoue, un message visible l’indique, la fermeture ne prétend pas avoir sauvegardé et la protection contre la perte de saisie reste active.

Le tableau **Inscriptions** regroupe les parcours commencés et les inscriptions finalisées pour l’année et l’établissement courants. La colonne **Statut** indique **En cours** pour un brouillon local du compte et **Terminé** pour une inscription enregistrée par l’API, même lorsqu’une avance laisse un solde à régler. Les lignes sont triées par date de création ou de dernière modification, de la plus récente à la plus ancienne. Un brouillon dont l’élève est déjà inscrit n’est plus affiché, pour éviter les doublons. **Reprendre** et la suppression du brouillon sont proposés sur les parcours en cours ; les inscriptions terminées conservent la consultation et le changement de salle selon les droits. À la reprise :

- Le dossier élève est retrouvé dans les données actuelles du serveur ; son ancien identifiant évite de recréer la fiche.
- Les tuteurs sont relus avant de revenir à la dernière grande étape. Un indicateur de progression local ne suffit pas à valider cette étape.
- Les classes, salles, frais, moyens de paiement et soldes sont vérifiés à nouveau. Les montants du brouillon restent à revoir et ne sont jamais renvoyés automatiquement en paiement. Un frais désormais soldé ne génère aucun nouveau versement.
- La confirmation reste manuelle, même si le brouillon avait atteint le récapitulatif.
- Après succès, le brouillon est retiré et les reçus sont présentés dans les inscriptions. Un brouillon dont l’élève est déjà inscrit n’est plus proposé.

Supprimer un brouillon demande confirmation et ne supprime ni le dossier élève, ni les tuteurs, ni une inscription existante.

**Limite du contrat API actuel :** aucun endpoint de brouillon n’est exposé. La progression non validée se reprend donc sur le même navigateur/appareil et avec le même compte. L’identité et les tuteurs déjà validés restent disponibles côté serveur et peuvent être retrouvés comme dossier existant sur un autre appareil. Le partage intégral des brouillons entre appareils ou opérateurs nécessite une API dédiée.

## Menu Élèves

Le catalogue permet uniquement la recherche par nom, prénom ou numéro et la consultation d’une fiche en modale. La fiche présente l’identité et, selon les droits, les tuteurs. Aucune création, modification, suppression, liaison ou suppression de tuteur n’est disponible depuis ce menu. Les anciens liens de fiche continuent d’ouvrir la consultation.

## Composants

- `enrollment-journey` orchestre les étapes et leur sauvegarde.
- `student-form` et `student-guardians` sont réutilisés pour l’identité et le tuteur.
- `student/guardian-form` isole la grille de saisie et sa validation, sans appel HTTP.
- `enrollment-form` conserve les contrôles de salle, soldes, avances et transaction finale.
- `service/enrollment-context-service` partage les lectures métier entre les étapes d’une modale.
- `models/enrollment/enrollment-draft.model.ts` et `service/enrollment-draft-service` définissent et isolent les brouillons.

Le parcours ne transmet que les champs d’identité supportés par `CreateStudentRequest` dans le Swagger actuel (`firstName`, `lastName`).
