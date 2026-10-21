describe('Disposition responsive partagée', () => {
  let host: HTMLElement;
  beforeEach(() => {
    host = document.createElement('div');
    host.style.width = '360px';
    document.body.append(host);
  });
  afterEach(() => host.remove());

  it('garde les champs sur une seule colonne dans un panneau étroit', () => {
    host.className = 'section';
    host.innerHTML =
      '<form class="form-grid md:grid-cols-3"><label class="form-field">Premier<input class="form-control"></label><label class="form-field">Deuxième<input class="form-control" type="date"></label><div class="form-actions"><button class="btn">Enregistrer</button></div></form>';
    const labels = host.querySelectorAll('label');
    const first = labels[0].getBoundingClientRect();
    const second = labels[1].getBoundingClientRect();
    expect(first.left).toBe(second.left);
    expect(second.top).toBeGreaterThanOrEqual(first.bottom);
    expect(first.width).toBeGreaterThan(250);
    expect(host.scrollWidth).toBeLessThanOrEqual(360);
  });

  it('ne crée pas de colonne implicite dans un formulaire à une colonne', () => {
    host.innerHTML =
      '<form class="form-grid md:grid-cols-1"><label class="form-field">Mot de passe<input class="form-control"></label><p class="form-error">Vérifiez votre saisie.</p><div class="form-actions"><button class="btn">Modifier le mot de passe</button></div></form>';
    const form = host.querySelector('form')!;
    const field = host.querySelector('label')!.getBoundingClientRect();
    const error = host.querySelector('.form-error')!.getBoundingClientRect();
    expect(getComputedStyle(form).gridTemplateColumns.split(' ').length).toBe(1);
    expect(field.width).toBeCloseTo(error.width, 0);
    expect(host.scrollWidth).toBeLessThanOrEqual(360);
  });

  it('confine le défilement horizontal d’un tableau à son conteneur', () => {
    host.className = 'page';
    host.innerHTML =
      '<section class="section"><div class="table-wrap"><table style="min-width:960px"><tbody><tr><td>Contenu large</td></tr></tbody></table></div></section>';
    const wrap = host.querySelector('.table-wrap')!;
    expect(wrap.scrollWidth).toBeGreaterThan(wrap.clientWidth);
    expect(getComputedStyle(wrap).overflowX).toBe('auto');
    expect(host.scrollWidth).toBeLessThanOrEqual(360);
  });
});
