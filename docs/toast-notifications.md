# Notifications partagées

`ToastComponent` est installé une seule fois dans `app.html`. Il affiche les notifications du `ToastService`, y compris au-dessus des modales, sans déplacer le focus.

```ts
private readonly toast = inject(ToastService);

// Après une action réussie ou refusée :
this.toast.success('La classe a été enregistrée.');
this.toast.error('Impossible d’enregistrer la classe.');
this.toast.info('Les données ont été actualisées.');
this.toast.warning('Vérifiez les informations saisies.');

// Options facultatives : titre et durée en millisecondes.
const id = this.toast.info('Traitement en cours.', { duration: 0, title: 'Import' });
this.toast.dismiss(id);
```

Les succès disparaissent après 4,5 secondes, les informations après 6 secondes, les avertissements après 7 secondes et les erreurs après 8 secondes. `duration: 0` conserve le message jusqu’à sa fermeture. Le survol et le focus suspendent le délai. La pile contient au maximum quatre notifications ; les doublons visibles sont regroupés et leur délai renouvelé. Le message est affiché comme du texte, sans interprétation HTML.

Pour relier un signal existant, appeler `connect` dans le constructeur du composant :

```ts
constructor() {
  this.toast.connect(this.successMessage, 'success');
  this.toast.connect(this.actionError, 'error');
}
```

La connexion est automatiquement détruite avec le composant. Remettre le signal à `null` au début d’une nouvelle action pour pouvoir afficher de nouveau un message identique. Les erreurs de validation restent aussi près des champs concernés. Les états de chargement et les erreurs de consultation restent dans les pages ; les toasts servent aux retours d’action. Les résultats comportant des liens ou des reçus conservent ces éléments dans la page.
