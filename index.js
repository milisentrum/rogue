const MAP_WIDTH = 40;   
const MAP_HEIGHT = 24;  
const ENEMY_TRIGGER_RADIUS = 5; // зона триггера противников на героя в клетках
const DIRECTIONS = [
    {dx:-1, dy:-1}, {dx:0, dy:-1}, {dx:1, dy:-1},
    {dx:-1, dy:0},               {dx:1, dy:0},
    {dx:-1, dy:1},  {dx:0, dy:1},  {dx:1, dy:1}
];


function Game() {
    this.map = [];
    this.enemies = {}; // HP всех врагов

    this.visibility = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        this.visibility[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            this.visibility[y][x] = false; // по умолчанию все невидимы
        }
    }
}


Game.prototype.init = function() {
    this.generateMap();
    this.generateRooms();
    this.generateCorridors();
    this.placeItems();
    this.placeHero();
    if (this.hero) {
        this.placeEnemies();
        this.updateInventory(); 
    }
    this.updateVisibility();
    this.renderMap();
    this.bindKeys();

    // Движение врагов каждые 500 мс
    this.enemyInterval = setInterval(() => {
        if (this.hero) {
            this.moveEnemies();
        } else {
            clearInterval(this.enemyInterval);
        }
    }, 500);
};


// кнопка restart
$(document).ready(function() {
    $("#restartBtn").click(() => {
        $("#restartBtn").hide();
        game = new Game();
        game.init(); 
    });
});


Game.prototype.bindKeys = function() {
    var self = this;
    $(document).keydown(function(e) {
        if (e.code === "Space" || e.key === " ") {
            e.preventDefault();
            self.attackHero();
            return;
        }
        var dx = 0, dy = 0;
        switch((e.key || "").toLowerCase()) {
            case "w": dy = -1; break;
            case "s": dy = 1; break;
            case "a": dx = -1; break;
            case "d": dx = 1; break;
            default: return;
        }

        self.moveHero(dx, dy);
    });
};


// инвентарь
Game.prototype.updateInventory = function() {
    const $inv = $(".inventory");
    $inv.empty();

    const $sword = $("<div class='inventory-item'></div>");
    $sword.append(`<img src='assets/images/tile-SW.png' alt='Меч'>`);
    const bonus = this.hero && this.hero.bonusAttackTurns ? this.hero.bonusAttackTurns : 0;
    $sword.append(`<span>${bonus}</span>`);
    $inv.append($sword);

};

Game.prototype.updateVisibility = function() {
    if (!this.hero) return;

    const radius = 3; // радиус света
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const dx = x - this.hero.x;
            const dy = y - this.hero.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            this.visibility[y][x] = distance <= radius;
        }
    }
};


// карта
Game.prototype.generateMap = function() {
    this.map = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        let row = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            row.push("W"); 
        }
        this.map.push(row);
    }
};

Game.prototype.renderMap = function() {
    const $field = $(".field");
    $field.empty();
    const tileSize = 50;

    if (!this.hero) return;

    const renderRadius = 8; // сколько клеток вокруг героя рендерить
    const startX = Math.max(0, this.hero.x - renderRadius);
    const endX = Math.min(this.map[0].length, this.hero.x + renderRadius);
    const startY = Math.max(0, this.hero.y - renderRadius);
    const endY = Math.min(this.map.length, this.hero.y + renderRadius);

    const lightRadius = 4; // радиус света героя

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const cell = this.map[y][x];
            const $tile = $("<div class='tile'></div>");
            $tile.css({ left: x * tileSize + "px", top: y * tileSize + "px" });

            // Расстояние до героя
            const dx = x - this.hero.x;
            const dy = y - this.hero.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Яркость
            let brightness = 0;
            if (dist <= lightRadius) {
                brightness = 100 - (dist / lightRadius) * 70;
            } else {
                brightness = 0.5; // темные, но видимые края
            }
            $tile.css("filter", `brightness(${brightness}%)`);

            // Отрисовка тайлов
            if (cell === "W") $tile.addClass("tileW");
            else if (cell === ".") $tile.addClass("tile-");
            else if (cell === "P") {
                $tile.addClass("tileP");
                const $hpBar = $("<div class='hp-bar'><div class='hp-fill'></div></div>");
                const hpPercent = (this.hero.hp / this.hero.maxHp) * 100;
                $hpBar.find(".hp-fill").css("width", hpPercent + "%");
                $tile.append($hpBar);
            }
            else if (cell === "E") {
                const key = y + "-" + x;
                if (dist <= lightRadius && this.enemies[key] != null) {
                    $tile.addClass("tileE");
                    const maxHp = 20;
                    const hpPercent = (this.enemies[key] / maxHp) * 100;
                    const $hpBar = $("<div class='hp-bar enemy-bar'><div class='hp-fill'></div></div>");
                    $hpBar.find(".hp-fill").css("width", hpPercent + "%");
                    $tile.append($hpBar);
                }
            }
            else if (cell === "HP") $tile.addClass("tileHP");
            else if (cell === "SW") $tile.addClass("tileSW");

            $field.append($tile);
        }
    }

    this.updateCamera(); // камера всегда после рендера
};

Game.prototype.generateRooms = function() {
    const roomCount = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < roomCount; i++) {
        const roomWidth = 3 + Math.floor(Math.random() * 6);
        const roomHeight = 3 + Math.floor(Math.random() * 6);
        const x = Math.floor(Math.random() * (MAP_WIDTH - roomWidth - 1));
        const y = Math.floor(Math.random() * (MAP_HEIGHT - roomHeight - 1));

        for (let yy = y; yy < y + roomHeight; yy++) {
            for (let xx = x; xx < x + roomWidth; xx++) {
                this.map[yy][xx] = ".";
            }
        }
    }
};

Game.prototype.generateCorridors = function() {
    const vCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < vCount; i++) {
        const x = Math.floor(Math.random() * MAP_WIDTH);
        for (let y = 0; y < MAP_HEIGHT; y++) this.map[y][x] = ".";
    }

    const hCount = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < hCount; j++) {
        const y = Math.floor(Math.random() * MAP_HEIGHT);
        for (let x = 0; x < MAP_WIDTH; x++) this.map[y][x] = ".";
    }
};

Game.prototype.placeItems = function() {
    this.placeObjects("SW", 2);
    this.placeObjects("HP", 10);
};

Game.prototype.placeHero = function() {
    const cell = this.getRandomEmptyCell();
    if (cell) {
        this.map[cell.y][cell.x] = "P";
        this.hero = {
            x: cell.x,
            y: cell.y,
            hp: 100,
            maxHp: 100,
            attack: 10,
            bonusAttack: 0,
            bonusAttackTurns: 0
        };
    }
};


Game.prototype.placeEnemies = function() {
    this.placeObjects("E", 10);
    // задаём HP каждому врагу
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (this.map[y][x] === "E") {
                this.enemies[y + "-" + x] = 20;
            }
        }
    }
};




Game.prototype.updateCamera = function() {
    const tileSize = 50;
    const cameraWidth = $(".field-box").width();
    const cameraHeight = $(".field-box").height();

    if (!this.hero) return;

    const heroX = this.hero.x * tileSize;
    const heroY = this.hero.y * tileSize;

    // сдвиг поля так, чтобы герой был в центре
    let offsetX = cameraWidth / 2 - heroX - tileSize / 2;
    let offsetY = cameraHeight / 2 - heroY - tileSize / 2;

    // ограничиваем камеру границами карты
    const maxOffsetX = 0;
    const maxOffsetY = 0;
    const minOffsetX = cameraWidth - this.map[0].length * tileSize;
    const minOffsetY = cameraHeight - this.map.length * tileSize;

    if (offsetX > maxOffsetX) offsetX = maxOffsetX;
    if (offsetX < minOffsetX) offsetX = minOffsetX;
    if (offsetY > maxOffsetY) offsetY = maxOffsetY;
    if (offsetY < minOffsetY) offsetY = minOffsetY;

    $(".field").css({
        left: offsetX + "px",
        top: offsetY + "px"
    });
};

Game.prototype.moveEnemies = function() {
    if (!this.hero) return;
    let newMap = this.map.map(row => row.slice());

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (this.map[y][x] === "E") {
                let moveX = 0, moveY = 0;
                const dx = this.hero.x - x;
                const dy = this.hero.y - y;

                if (Math.abs(dx) <= ENEMY_TRIGGER_RADIUS && Math.abs(dy) <= ENEMY_TRIGGER_RADIUS) {
                    if (dx !== 0 && (Math.random() < 0.5 || dy === 0)) moveX = dx > 0 ? 1 : -1;
                    else if (dy !== 0) moveY = dy > 0 ? 1 : -1;
                } else {
                    const dir = Math.floor(Math.random() * 4);
                    if (dir === 0) moveX = 1;
                    else if (dir === 1) moveX = -1;
                    else if (dir === 2) moveY = 1;
                    else if (dir === 3) moveY = -1;
                }

                const newX = x + moveX;
                const newY = y + moveY;
                const oldKey = y + "-" + x;
                const newKey = newY + "-" + newX;

                if (
                    newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT &&
                    newMap[newY][newX] === "."
                ) {
                    newMap[newY][newX] = "E";
                    newMap[y][x] = ".";
                    this.enemies[newKey] = this.enemies[oldKey];
                    delete this.enemies[oldKey];
                }
            }
        }
    }


    this.map = newMap;
    this.enemiesAttackHero();
    this.checkHeroDeath();
    this.updateVisibility();
    this.renderMap();
};


Game.prototype.checkHeroDeath = function() {
    if (this.hero && this.hero.hp <= 0) {
        this.hero.hp = 0;
        this.map[this.hero.y][this.hero.x] = ".";
        if (this.enemyInterval) clearInterval(this.enemyInterval);
        this.hero = null;
        this.updateVisibility();
        this.renderMap();
        alert("Game Over!");

        $("#restartBtn").show();
        return true;
    }
    return false;
};



Game.prototype.moveHero = function(dx, dy) {
    if (!this.hero) return;
    const newX = this.hero.x + dx;
    const newY = this.hero.y + dy;

    if (!this.isInsideMap(newX, newY)) return;

    const targetCell = this.map[newY][newX];

    if (targetCell === "W" || targetCell === "E") return;

    if (targetCell === "HP") {
        this.hero.hp = Math.min(this.hero.hp + 20, this.hero.maxHp);
    } 
    else if (targetCell === "SW") {
        this.hero.bonusAttackTurns = 5; // задаем заряды меча
        console.log("Подобран меч! Зарядов меча: 5");

        this.updateInventory();
    }


    this.map[this.hero.y][this.hero.x] = ".";
    this.hero.x = newX;
    this.hero.y = newY;
    this.map[newY][newX] = "P";

    this.checkHeroDeath();
    this.updateVisibility();
    this.renderMap();
};



Game.prototype.attackHero = function() {
    if (!this.hero) return;

    const heroX = this.hero.x;
    const heroY = this.hero.y;
    let enemiesHit = false;

    for (let dir of DIRECTIONS) {
        const nx = heroX + dir.dx;
        const ny = heroY + dir.dy;

        if (!this.isInsideMap(nx, ny)) continue;

        const key = ny + "-" + nx;

        if (this.map[ny][nx] === "E" && this.enemies[key] != null) {
            if (this.hero.bonusAttackTurns > 0) {
                // меч убивает врага с одного удара
                this.map[ny][nx] = ".";
                delete this.enemies[key];
                this.hero.bonusAttackTurns--;
                console.log("Враг мгновенно убит мечом!");
                console.log("Осталось зарядов меча:", this.hero.bonusAttackTurns);
            } else {
                // обычная атака
                this.enemies[key] -= this.hero.attack;
                console.log(`Урон ${this.hero.attack}, осталось HP:`, this.enemies[key]);
                if (this.enemies[key] <= 0) {
                    this.map[ny][nx] = ".";
                    delete this.enemies[key];
                    console.log("Враг убит обычной атакой!");
                }
            }
            enemiesHit = true;
        }
    }

    if (enemiesHit) this.updateInventory();
    this.updateVisibility();
    this.renderMap();
};






Game.prototype.enemiesAttackHero = function() {
    if (!this.hero) return;
    const heroX = this.hero.x;
    const heroY = this.hero.y;

    for (let dir of DIRECTIONS) {
        const nx = heroX + dir.dx;
        const ny = heroY + dir.dy;
        if (this.isInsideMap(nx, ny) && this.map[ny][nx] === "E") {
            this.hero.hp -= 10;
            console.log("Герой получает урон! HP:", this.hero.hp);
        }
    }
};



// вспомогательные функции
Game.prototype.getRandomEmptyCell = function() {
    const emptyCells = [];
    for (let y = 0; y < this.map.length; y++) {
        for (let x = 0; x < this.map[y].length; x++) {
            if (this.map[y][x] === ".") emptyCells.push({x, y});
        }
    }
    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
};

Game.prototype.placeObjects = function(type, count) {
    for (let i = 0; i < count; i++) {
        const cell = this.getRandomEmptyCell();
        if (cell) this.map[cell.y][cell.x] = type;
    }
};

Game.prototype.isInsideMap = function(x, y) {
    return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT;
};
