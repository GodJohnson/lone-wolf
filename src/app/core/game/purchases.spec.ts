import {
  choicePayment,
  guessPrice,
  parseBuySentence,
  parsePriceLine,
  paymentsOf,
} from './purchases';

describe('parsePriceLine', () => {
  it('lit une ligne « Nom—N Gold Crowns »', () => {
    expect(parsePriceLine('Short Sword—3 Gold Crowns')).toMatchObject({
      name: 'Short Sword',
      price: 3,
    });
    expect(parsePriceLine('Backpack—1 Gold Crown')).toMatchObject({ name: 'Backpack', price: 1 });
  });
  it('ignore la parenthèse d’effet et la note de bas de page', () => {
    expect(
      parsePriceLine('Potion of Laumspur (restores 4 ENDURANCE points)—5 Gold Crowns'),
    ).toMatchObject({ name: 'Potion of Laumspur', price: 5 });
    expect(parsePriceLine('Mace—4 Gold Crowns 1')).toMatchObject({ name: 'Mace', price: 4 });
  });
  it('lit les pluriels « each » sans tiret', () => {
    expect(parsePriceLine('Swords 4 Gold Crowns each')).toMatchObject({ name: 'Sword', price: 4 });
    expect(parsePriceLine('Quarterstaves 3 Gold Crowns each')).toMatchObject({
      name: 'Quarterstaff',
      price: 3,
    });
  });
  it('ignore ce qui n’est pas une ligne de prix', () => {
    expect(parsePriceLine('12 Gold Crowns')).toBeNull();
    expect(parsePriceLine('Fine Foods 2 Gold Crowns per Meal')).toBeNull();
  });
});

describe('parseBuySentence', () => {
  it('reconnaît un achat voulu par le joueur', () => {
    expect(
      parseBuySentence('If you wish to buy the documents, pay the boy 6 Gold Crowns.'),
    ).toMatchObject({ name: 'Documents', price: 6 });
  });
  it('écarte les refus et les phrases sans souhait', () => {
    expect(
      parseBuySentence('If you do not wish to buy the waistcoat, pay nothing 5 Gold Crowns.'),
    ).toBeNull();
    expect(parseBuySentence('The man will buy your sword for 5 Gold Crowns.')).toBeNull();
  });
});

describe('choicePayment', () => {
  it('lit le prix d’un choix payant', () => {
    expect(
      choicePayment('If you wish to ride inside, pay the driver 3 Gold Crowns and turn to 37.'),
    ).toBe(3);
    expect(
      choicePayment(
        'If you would prefer to stay on the roof, pay him one Gold Crown and turn to 148.',
      ),
    ).toBe(1);
  });
  it('écarte les refus et les paiements reçus', () => {
    expect(
      choicePayment(
        'If you do not want to buy it or cannot afford to pay him 5 Gold Crowns, turn to 9.',
      ),
    ).toBeNull();
    expect(choicePayment('If you wish to continue, turn to 12.')).toBeNull();
  });
  it('paymentsOf cible les blocs choice', () => {
    expect(
      paymentsOf([
        { kind: 'html', html: '<p>pay 3 Gold Crowns</p>' },
        { kind: 'choice', html: 'If you wish to rest, pay the man 2 Gold Crowns and turn to 5.' },
      ]),
    ).toEqual([null, 2]);
  });
});

describe('guessPrice', () => {
  it('trouve le prix après ou avant la sélection', () => {
    expect(guessPrice('A rope is on sale for 3 Gold Crowns.', 'rope')).toBe(3);
    expect(guessPrice('It costs 4 Gold Crowns to get the lantern', 'lantern')).toBe(4);
    expect(guessPrice('Nothing here', 'rope')).toBe(0);
  });
});
