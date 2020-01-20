(function() {
    'use strict';

    const nothing = Symbol('Nothing.');

    const primitiveTokens = [{
        token: 'true',
        value: true
    }, {
        token: 'false',
        value: false
    }, {
        token: 'null',
        value: null
    }, {
        token: 'undefined',
        value: undefined
    }, {
        token: 'Infinity',
        value: Infinity
    }, {
        token: 'NaN',
        value: NaN
    }, {
        token: '-Infinity',
        value: -Infinity
    }, {
        token: '-NaN',
        value: NaN
    }];

    const symbols = {
        closeBrace: '}',
        closeBracket: ']',
        colon: ':',
        comma: ',',
        dateDelimiter: '@',
        openBrace: '{',
        openBracket: '[',
        referenceDelimiter: '#',
        quote: '"'
    };

    const structuralSymbols = {
        [symbols.comma]: symbols.comma,
        [symbols.colon]: symbols.colon,
        [symbols.openBrace]: symbols.openBrace,
        [symbols.closeBrace]: symbols.closeBrace,
        [symbols.openBracket]: symbols.openBracket,
        [symbols.closeBracket]: symbols.closeBracket
    };

    const numericalSymbols = {
        bigIntSuffix: 'n',
        exponentialOperator: 'e',
        fractionalDelimiter: '.',
        unaryInverse: '-'
    };

    const numericalCharacters = {
        [numericalSymbols.unaryInverse]: numericalSymbols.unaryInverse,
        [numericalSymbols.fractionalDelimiter]: numericalSymbols.fractionalDelimiter,
        [numericalSymbols.exponentialOperator]: numericalSymbols.exponentialOperator,
        [numericalSymbols.bigIntSuffix]: numericalSymbols.bigIntSuffix,
        0: '0',
        1: '1',
        2: '2',
        3: '3',
        4: '4',
        5: '5',
        6: '6',
        7: '7',
        8: '8',
        9: '9'
    };

    const whiteSpaceRegex = /\s/;
    const keychainDelimiter = '","';

    function throwNumericalParsingError(line, column) {
        throw new Error(`Invalid JSORN: Expected numerical value at line: ${line} and column: ${column}.`)
    }

    function parseNumber(string, line, column) {
        let parsedString = string;
        let character = 0;
        let exponent = 0;
        let exponentialPower = 1;
        let decimalNumerator = 0;
        let decimalDenominator = 1;
        let isNegative = false;
        let isReciprocal = false;
        let exponentialIndex = -1;
        let decimalIndex = -1;
        let constructor = Number;

        if (parsedString[0] === numericalSymbols.unaryInverse) {
            isNegative = true;
            parsedString = parsedString.slice(1);
        }

        if (!parsedString.length) {
            throwNumericalParsingError(line, column + 1);
        }

        if (parsedString[parsedString.length - 1] === numericalSymbols.bigIntSuffix) {
            constructor = BigInt;
            character = constructor(character);
            parsedString= parsedString.slice(0, parsedString.length - 1);
        }

        if (!parsedString.length) {
            throwNumericalParsingError(line, column + 2);
        }

        for (let i = 0; i < parsedString.length; ++i) {
            const char = parsedString[i];

            if (char === numericalSymbols.exponentialOperator) {
                if (constructor === BigInt || exponentialIndex > -1 || (decimalIndex > -1 && decimalIndex + 1 === i)) {
                    throwNumericalParsingError(line, column + i);
                }

                exponentialIndex = i;
            } else if (char === numericalSymbols.fractionalDelimiter) {
                if (constructor === BigInt || decimalIndex > -1 || (exponentialIndex > -1 && i > exponentialIndex)) {
                    throwNumericalParsingError(line, column + i);
                }

                decimalIndex = i;
                character = Number(character);
            } else if (char === numericalSymbols.bigIntSuffix) {
                throwNumericalParsingError(line, column + i);
            } else if (char === numericalSymbols.unaryInverse) {
                if (constructor === BigInt || isReciprocal || exponentialIndex === -1 || i > exponentialIndex + 1) {
                    throwNumericalParsingError(line, column + i);
                }
                
                isReciprocal = true;
            } else {
                if (exponentialIndex > -1) {
                    exponent *= (char === '0' && exponent === 0 ? 1: 10);
                    exponent += +char;
                } else if (decimalIndex > -1) {
                    decimalDenominator *= 10;
                    decimalNumerator *= 10;
                    decimalNumerator += (+char);
                } else {
                    character *= constructor(10);
                    character += constructor(+char);
                }
            }
        }

        for (let i = 1; i <= exponent; ++i) {
            exponentialPower *= 10;
        }

        const mantissa = decimalNumerator / decimalDenominator;

        return (constructor(isNegative ? -1 : 1)) * (character + mantissa) * (isReciprocal ? 1 / exponentialPower : exponentialPower);
    }

    function lexNumber(string, line, column) {
        let lexing = string;
        let token = '';

        for (let i = 0; i < lexing.length; ++i) {
            const char = lexing[i];

            if (numericalCharacters[char]) {
                token += char;
            } else {
                break;
            }
        }

        if (!token.length) {
            return [
                nothing,
                string
            ];
        }

        return [
            parseNumber(token, line, column),
            string.slice(token.length)
        ]
    }

    function lexKeyword(string) {
        for (let i = 0; i < primitiveTokens.length; ++i) {
            const keyword = primitiveTokens[i];

            if (string.length >= keyword.token.length && string.slice(0, keyword.token.length) === keyword.token) {
                return [
                    keyword.value,
                    string.slice(keyword.token.length)
                ];
            }
        }

        return [
            nothing,
            string
        ];
    }

    function lexTemplate(errorMessage, delimiter, evaluator) {
        return function(string, line, column) {
            let token = '';
            let lexing = string;

            if (string[0] === delimiter) {
                lexing = lexing.slice(1);
            } else {
                return [
                    nothing,
                    string
                ];
            }

            for (let i = 0; i < lexing.length; ++i) {
                const char = lexing[i];
    
                if (char === delimiter) {
                    let evaluated;

                    if (evaluator) {
                        evaluated = evaluator(token); 
                    }

                    return [
                        evaluated || token,
                        lexing.slice(i + 1)
                    ];
                } else {
                    token += char;
                }
            }
    
            throw new Error(`${errorMessage} on line: ${line} and column: ${column}.`);
        };
    }
    
    function dateEvaluator(token, line, column) {
        const numerical = +token;
        const date = isNaN(numerical) ? new Date(token) : new Date(numerical);

        if (isNaN(date.getTime())) {
            throw new Error(`Invalid JSORN: Expected valid Date constructor argument on line: ${line} between columns: ${column} and ${column + token.length}.`);
        }

        return date;
    }

    class ObjectReference {
        constructor(string, line, column) {
            let keychain = [];
            let lexing = string;

            if (string.length > 1) {
                if (string[0] !== symbols.quote || string[string.length - 1] !== symbols.quote) {
                    throw new Error(`Invalid JSORN: Expected reference delimiters on line: ${line} on columns: ${column} and ${column + string.length}.`);
                }

                lexing = string.substring(1, lexing.length - 1);
                keychain = lexing.split(keychainDelimiter);
            }

            this.keychain = keychain;
        }
    }

    function referenceEvaluator(token, line, column) {
        return new ObjectReference(token, line, column);
    }

    const lexers = [
        lexTemplate('Invalid JSORN: Expected end of string quote', symbols.quote),
        lexKeyword,
        lexNumber,
        lexTemplate('Invaid JSORN: Expected end of date delimiter ', symbols.dateDelimiter, dateEvaluator),
        lexTemplate('Invalid JSORN: Expected end of reference delimitor ', symbols.referenceDelimiter, referenceEvaluator)
    ];

    function lex(jsorn) {
        const tokens = [];
        let string = jsorn;
        let line = 0;
        let column = 0;

        while (string.length) {
            for (let i = 0; i < lexers.length; ++i) {
                const [
                    token,
                    remainingString
                ] = lexers[i](string, line, column);

                if (token !== nothing) {
                    tokens.push(token);
                    string = remainingString;
                    column += token.length;

                    break;
                }
            }

            const char = string[0];

            if (whiteSpaceRegex.test(char)) {
                if (char === '\n') {
                    ++line;
                    column = 0;
                } else {
                    ++column;
                }

                string = string.slice(1);
            } else if (structuralSymbols[char]) {
                tokens.push(char);
                string = string.slice(1);
                ++column;
            } else {
                throw new Error(`Invalid JSORN: Unexpected character, ${char} at line: ${line} and column: ${column}.`);
            }
        }

        return tokens;
    }

    function isObject(value) {
        return typeof value === 'object' && value !== null
    }

    function isDate(value) {
        return isObject(value) && (value instanceof Date);
    }

    function isString(value) {
        return typeof value === 'string';
    }

    function isBoolean(value) {
        return typeof value === 'boolean';
    }

    function isNull(value) {
        return value === null;
    }

    function isUndefined(value) {
        return value === undefined;
    }

    function isNumber(value) {
        return typeof value === 'number';
    }

    function isBigInt(value) {
        return typeof value === 'bigint';
    }

    function isPrimitive(value) {
        return isBoolean(value) || isNumber(value) || isNull(value) || isUndefined(value);
    }

    function getObjectFromReference(object, objectReference) {
        if (isObject(object)) {
            let concrete = object;

            for (let i = 0; i < objectReference.keychain.length; ++i) {
                concrete = concrete[objectReference.keychain[i]];

                if (!isObject(concrete)) {
                    throw new Error(`Invalid JSORN: Expected object reference to be defined.`);
                }
            }

            return concrete;
        }

        return undefined;
    }

    function parse(josrn) {
        if (!isString(jsorn)) {
            throw new Error('Invalid JSORN: Expected a string.');
        }

        const tokens = lex(josrn);

        console.log(tokens);
    }

    const stringifyers = {
        string: (value) => `${symbols.quote}${value}${symbols.quote}`,
        date: (value) =>  `${symbols.dateDelimiter}${value.getTime()}${symbols.dateDelimiter}`,
        primitive: (value) => `${value}`,
        bigInt: (value) => `${value}n`,
    };

    function stringify(value) {
        const referenceMap = new WeakMap();
        const queue = [];

        if (Array.isArray(value)) {
            
        } else if (isDate(value)) {
            return stringifyers.date(value);
        } else if (isObject(value)) {

        } else if (isString(value)) {
            return stringifyers.string(value);
        } else if (isBigInt(value)) {
            return stringifyers.bigInt(value);
        } else if (isPrimitive(value)) {
            return stringifyers.primitive(value);
        }

        return '';
    }

    globalThis.JSORN = Object.freeze({
        parse,
        stringify
    });
}());